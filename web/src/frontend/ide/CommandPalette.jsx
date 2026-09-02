'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Command, ChevronsLeftRight, Braces, CornerDownLeft } from 'lucide-react';
import { Kbd } from '../ui';
import { useWorkspace } from './WorkspaceContext';
import FileIcon from './FileIcon';
import { fuzzyMatch } from '../lib/fuzzy';
import { baseName, dirName, extOf } from '../lib/fileTypes';

function Highlight({ text, indices }) {
  if (!indices?.length) return text;
  const set = new Set(indices);
  return text.split('').map((ch, i) => (set.has(i) ? <mark key={i}>{ch}</mark> : ch));
}

const MODE_META = {
  commands: { label: 'Commands', prefix: '>', placeholder: 'Type a command…', icon: Command },
  files: { label: 'Files', prefix: '', placeholder: 'Search files by name…', icon: Search },
  line: { label: 'Go to line', prefix: ':', placeholder: 'Line number (e.g. 42 or 42:8)…', icon: ChevronsLeftRight },
  symbols: { label: 'Symbols', prefix: '@', placeholder: 'Go to symbol in file…', icon: Braces },
};

// crude symbol extraction: functions / classes / defs per language
function extractSymbols(content = '') {
  const out = [];
  const lines = content.split('\n');
  const patterns = [
    /^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
    /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
    /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
    /^\s*(?:def|async def)\s+([A-Za-z_]\w*)/,
    /^\s*(?:public|private|protected|static|\s)*[\w<>[\],\s]+\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*(?:throws[^{]*)?\{/,
    /^\s*(?:template\s*<[^>]*>\s*)?[\w:<>*&\s]+\s+([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:const)?\s*\{/,
    /^\s*(?:struct|enum|interface|type)\s+([A-Za-z_]\w*)/,
  ];
  lines.forEach((l, i) => {
    for (const p of patterns) {
      const m = l.match(p);
      if (m && m[1] && !['if', 'for', 'while', 'switch', 'return', 'else', 'catch'].includes(m[1])) { out.push({ name: m[1], line: i + 1, text: l.trim() }); break; }
    }
  });
  return out;
}

export default function CommandPalette({ commands }) {
  const ws = useWorkspace();
  const { palette, closePalette, files, openFile, activeTab, editorRef, contentsRef, tabs } = ws;
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const mode = useMemo(() => {
    if (query.startsWith('>')) return 'commands';
    if (query.startsWith(':')) return 'line';
    if (query.startsWith('@')) return 'symbols';
    if (palette.mode === 'commands' || palette.mode === 'line' || palette.mode === 'symbols') return query === '' ? palette.mode : 'files';
    return 'files';
  }, [query, palette.mode]);
  const q = useMemo(() => query.replace(/^[>:@]\s*/, ''), [query]);

  useEffect(() => {
    if (!palette.open) return;
    const prefix = palette.mode === 'commands' ? '>' : palette.mode === 'line' ? ':' : palette.mode === 'symbols' ? '@' : '';
    setQuery(prefix + (palette.query || ''));
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 10);
  }, [palette.open, palette.mode, palette.query]);

  const items = useMemo(() => {
    if (!palette.open) return [];
    if (mode === 'commands') {
      const scored = commands
        .map((c) => {
          const m = fuzzyMatch(q, `${c.group} ${c.label}`) || (c.keywords ? fuzzyMatch(q, `${c.group} ${c.label} ${c.keywords}`) : null);
          return { ...c, m };
        })
        .filter((c) => c.m);
      scored.sort((a, b) => b.m.score - a.m.score);
      const list = q ? scored : commands;
      return list.slice(0, 60).map((c) => ({ id: c.id, kind: 'command', label: c.label, group: c.group, icon: c.icon, shortcut: c.shortcut, indices: q ? c.m.indices.map((i) => i - c.group.length - 1).filter((i) => i >= 0 && i < c.label.length) : [], run: c.run }));
    }
    if (mode === 'files') {
      const recent = tabs.slice().reverse();
      const source = q ? files : [...recent, ...files.filter((f) => !recent.includes(f))];
      const scored = source.map((f) => ({ f, m: fuzzyMatch(q, f) })).filter((x) => x.m);
      if (q) scored.sort((a, b) => b.m.score - a.m.score);
      return scored.slice(0, 80).map(({ f, m }) => ({ id: f, kind: 'file', label: baseName(f), detail: dirName(f), file: f, indices: m.indices.filter((i) => i >= f.length - baseName(f).length).map((i) => i - (f.length - baseName(f).length)), group: !q && recent.includes(f) ? 'Recently opened' : 'Files', run: () => openFile(f) }));
    }
    if (mode === 'line') {
      const m = q.match(/^(\d+)(?::(\d+))?/);
      const content = activeTab ? contentsRef.current.get(activeTab) || '' : '';
      const total = content ? content.split('\n').length : 0;
      if (!activeTab) return [{ id: 'noline', kind: 'info', label: 'Open a file to go to a line' }];
      if (!m) return [{ id: 'hint', kind: 'info', label: `Type a line number between 1 and ${total || '…'}` }];
      const line = Math.min(Number(m[1]), total || Number(m[1]));
      return [{ id: 'goto', kind: 'line', label: `Go to line ${line}${m[2] ? `, column ${m[2]}` : ''}`, detail: `of ${total}`, run: () => editorRef.current?.revealLine(line, m[2] ? Number(m[2]) : 1) }];
    }
    if (mode === 'symbols') {
      if (!activeTab) return [{ id: 'nosym', kind: 'info', label: 'Open a file to browse its symbols' }];
      const syms = extractSymbols(contentsRef.current.get(activeTab) || editorRef.current?.getContent?.() || '');
      const scored = syms.map((s) => ({ s, m: fuzzyMatch(q, s.name) })).filter((x) => x.m);
      if (q) scored.sort((a, b) => b.m.score - a.m.score);
      if (!scored.length) return [{ id: 'nosyms', kind: 'info', label: q ? 'No matching symbols' : `No symbols detected in ${baseName(activeTab)}` }];
      return scored.slice(0, 80).map(({ s, m }) => ({ id: `${s.name}:${s.line}`, kind: 'symbol', label: s.name, detail: `:${s.line}  ${s.text.slice(0, 60)}`, indices: m.indices, run: () => editorRef.current?.revealLine(s.line) }));
    }
    return [];
  }, [palette.open, mode, q, commands, files, tabs, activeTab, contentsRef, editorRef, openFile]);

  useEffect(() => { setActive(0); }, [items.length, mode, q]);
  useEffect(() => {
    const el = listRef.current?.querySelector('.palette__item.is-active');
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!palette.open) return null;

  const runItem = (it) => {
    if (!it || it.kind === 'info') return;
    closePalette();
    setTimeout(() => it.run?.(), 0);
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); runItem(items[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'Tab') { e.preventDefault(); }
  };

  const meta = MODE_META[mode];
  const ModeIcon = meta.icon;
  let lastGroup = null;

  return createPortal(
    <div className="palette-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) closePalette(); }}>
      <div className="palette" role="dialog" aria-label="Command palette" onKeyDown={onKeyDown}>
        <div className="palette__input">
          <ModeIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={meta.placeholder}
            aria-label={meta.placeholder}
            aria-activedescendant={items[active] ? `pal-${items[active].id}` : undefined}
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            spellCheck={false}
            autoComplete="off"
          />
          <span className="palette__mode">{meta.label}</span>
        </div>
        <div className="palette__list" ref={listRef} id="palette-list" role="listbox">
          {items.length ? items.map((it, i) => {
            const showGroup = it.group && it.group !== lastGroup;
            lastGroup = it.group || lastGroup;
            return (
              <React.Fragment key={it.id}>
                {showGroup ? <div className="palette__group">{it.group}</div> : null}
                <div
                  id={`pal-${it.id}`}
                  role="option"
                  aria-selected={i === active}
                  className={`palette__item ${i === active ? 'is-active' : ''}`}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => runItem(it)}
                >
                  <span className="palette__icon">{it.kind === 'file' ? <FileIcon name={it.file} size="sm" /> : it.kind === 'symbol' ? <Braces /> : it.kind === 'line' ? <ChevronsLeftRight /> : it.icon || <Command />}</span>
                  <span className="palette__label"><Highlight text={it.label} indices={it.indices} /></span>
                  {it.detail ? <span className="palette__detail">{it.detail}</span> : null}
                  {it.shortcut ? <Kbd combo={it.shortcut} /> : null}
                  {it.kind === 'file' && extOf(it.file) ? null : null}
                </div>
              </React.Fragment>
            );
          }) : (
            <div className="palette__empty">No results for “{q}”</div>
          )}
        </div>
        <div className="palette__foot">
          <span><Kbd keys={['↑', '↓']} /> navigate</span>
          <span><CornerDownLeft style={{ width: 12, height: 12 }} /> select</span>
          <span><Kbd keys={['Esc']} /> close</span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-4)' }}>{mode === 'files' ? 'Type > for commands, : for line, @ for symbols' : mode === 'commands' ? `${items.length} commands` : ''}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

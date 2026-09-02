'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Replace, ChevronRight, ChevronDown, ReplaceAll, Loader2, ChevronsDownUp } from 'lucide-react';
import { IconButton, Input, Button, useToast } from '../../ui';
import { useWorkspace } from '../WorkspaceContext';
import FileIcon from '../FileIcon';
import { baseName, dirName } from '../../lib/fileTypes';

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export default function SearchView() {
  const ws = useWorkspace();
  const { files, getContent, openFile, editorRef, contentsRef, handleContentChange, saveFile, activeTab } = ws;
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [replace, setReplace] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCase] = useState(false);
  const [wholeWord, setWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [results, setResults] = useState([]); // [{file, matches:[{line, col, text, from, to}]}]
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(null); // `${file}:${idx}`
  const inputRef = useRef(null);
  const reqId = useRef(0);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const buildRegex = useCallback(() => {
    if (!query) return null;
    try {
      let src = regex ? query : escapeRe(query);
      if (wholeWord) src = `\\b${src}\\b`;
      return new RegExp(src, caseSensitive ? 'g' : 'gi');
    } catch {
      return null;
    }
  }, [query, regex, wholeWord, caseSensitive]);

  const invalidRegex = regex && query && !buildRegex();

  // Debounced project-wide search across cached / fetched contents
  useEffect(() => {
    const re = buildRegex();
    if (!re) { setResults([]); return; }
    const id = ++reqId.current;
    setSearching(true);
    const t = setTimeout(async () => {
      const out = [];
      for (const f of files) {
        let content;
        try { content = await getContent(f); } catch { continue; }
        if (id !== reqId.current) return;
        const matches = [];
        const lines = content.split('\n');
        let offset = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(line))) {
            matches.push({ line: i + 1, col: m.index + 1, text: line, from: offset + m.index, to: offset + m.index + m[0].length, len: m[0].length });
            if (m[0].length === 0) re.lastIndex++;
            if (matches.length > 500) break;
          }
          offset += line.length + 1;
        }
        if (matches.length) out.push({ file: f, matches });
      }
      if (id === reqId.current) { setResults(out); setSearching(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [buildRegex, files, getContent]);

  const total = useMemo(() => results.reduce((n, r) => n + r.matches.length, 0), [results]);
  // Flat list of visible matches for keyboard navigation
  const flat = useMemo(() => results.flatMap((r) => (collapsed.has(r.file) ? [] : r.matches.map((m, i) => ({ file: r.file, m, key: `${r.file}:${i}` })))), [results, collapsed]);
  const resultsRef = useRef(null);
  const moveActive = (delta) => {
    if (!flat.length) return;
    const idx = flat.findIndex((x) => x.key === active);
    const next = flat[Math.max(0, Math.min(flat.length - 1, (idx < 0 ? (delta > 0 ? -1 : flat.length) : idx) + delta))];
    if (next) { setActive(next.key); requestAnimationFrame(() => resultsRef.current?.querySelector('.search__match.is-active')?.scrollIntoView({ block: 'nearest' })); }
  };
  const onResultsKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Enter') { const cur = flat.find((x) => x.key === active); if (cur) { e.preventDefault(); goTo(cur.file, cur.m, cur.key); } }
    else if (e.key === 'Escape') { inputRef.current?.focus(); }
  };

  const goTo = (file, m, key) => {
    setActive(key);
    openFile(file);
    // Editor mounts async; poll briefly for the api of the right file
    let tries = 0;
    const tick = () => {
      const ed = editorRef.current;
      if (ed && ed.file === file) { ed.selectRange(m.from, m.to); return; }
      if (tries++ < 30) setTimeout(tick, 60);
    };
    setTimeout(tick, 30);
  };

  const applyReplace = async (file, only) => {
    const re = buildRegex();
    if (!re) return;
    const content = await getContent(file);
    let next;
    if (only) {
      next = content.slice(0, only.from) + content.slice(only.from, only.to).replace(new RegExp(re.source, re.flags.replace('g', '')), replace) + content.slice(only.to);
    } else {
      next = content.replace(re, replace);
    }
    if (next === content) return;
    const ed = editorRef.current;
    if (ed && ed.file === file) ed.replaceAll(next);
    else { contentsRef.current.set(file, next); handleContentChange(file, next); }
    if (!ed || ed.file !== file) await saveFile(file, { silent: true });
    reqId.current++;
    setResults((rs) => rs.map((r) => (r.file === file ? { ...r, matches: only ? r.matches.filter((m) => m !== only) : [] } : r)).filter((r) => r.matches.length));
  };

  const replaceAll = async () => {
    const n = total;
    for (const r of results) await applyReplace(r.file);
    toast({ kind: 'success', title: `Replaced ${n} occurrence${n === 1 ? '' : 's'} in ${results.length} file${results.length === 1 ? '' : 's'}` });
  };

  const renderLine = (m) => {
    const before = m.text.slice(Math.max(0, m.col - 1 - 40), m.col - 1);
    const hit = m.text.slice(m.col - 1, m.col - 1 + m.len);
    const after = m.text.slice(m.col - 1 + m.len, m.col - 1 + m.len + 80);
    return (
      <span className="search__line">
        {before.trimStart()}
        {showReplace && replace !== undefined ? (<><mark className="repl-old">{hit}</mark><span className="repl">{replace}</span></>) : <mark>{hit}</mark>}
        {after}
      </span>
    );
  };

  return (
    <div className="search">
      <div className="search__inputs">
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <IconButton size="sm" label={showReplace ? 'Hide replace' : 'Show replace'} onClick={() => setShowReplace((s) => !s)}>{showReplace ? <ChevronDown /> : <ChevronRight />}</IconButton>
          <Input
            ref={inputRef}
            size="sm"
            icon={<Search />}
            placeholder="Search in project"
            value={query}
            invalid={!!invalidRegex}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
              if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); resultsRef.current?.focus(); }
              if (e.key === 'Enter') { const cur = flat.find((x) => x.key === active) || flat[0]; if (cur) goTo(cur.file, cur.m, cur.key); }
            }}
            style={{ flex: 1 }}
            trailing={
              <span className="search__opts">
                <button type="button" className={`search__opt ${caseSensitive ? 'is-active' : ''}`} title="Match case" aria-pressed={caseSensitive} onClick={() => setCase((c) => !c)}>Aa</button>
                <button type="button" className={`search__opt ${wholeWord ? 'is-active' : ''}`} title="Whole word" aria-pressed={wholeWord} onClick={() => setWord((w) => !w)}>ab</button>
                <button type="button" className={`search__opt ${regex ? 'is-active' : ''}`} title="Regular expression" aria-pressed={regex} onClick={() => setRegex((r) => !r)}>.*</button>
              </span>
            }
          />
        </div>
        {showReplace ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', paddingLeft: 26 }}>
            <Input size="sm" icon={<Replace />} placeholder="Replace" value={replace} onChange={(e) => setReplace(e.target.value)} style={{ flex: 1 }} />
            <IconButton size="sm" label="Replace all" disabled={!total} onClick={replaceAll}><ReplaceAll /></IconButton>
          </div>
        ) : null}
      </div>
      <div className="search__summary">
        {searching ? <><Loader2 style={{ width: 12, height: 12, animation: 'cv-spin 0.8s linear infinite' }} /> Searching…</> : query ? (invalidRegex ? <span style={{ color: 'var(--danger)' }}>Invalid regular expression</span> : `${total} result${total === 1 ? '' : 's'} in ${results.length} file${results.length === 1 ? '' : 's'}`) : 'Type to search across all project files.'}
        {results.length ? <IconButton size="sm" label="Collapse all" style={{ marginLeft: 'auto' }} onClick={() => setCollapsed(new Set(results.map((r) => r.file)))}><ChevronsDownUp /></IconButton> : null}
      </div>
      <div className="search__results" role="tree" tabIndex={0} ref={resultsRef} onKeyDown={onResultsKey} aria-label="Search results">
        {results.map((r) => {
          const isCollapsed = collapsed.has(r.file);
          return (
            <div key={r.file}>
              <div className="search__file" role="treeitem" aria-selected={false} aria-expanded={!isCollapsed} onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(r.file)) n.delete(r.file); else n.add(r.file); return n; })}>
                <span className={`tree__chev ${isCollapsed ? '' : 'is-open'}`}><ChevronRight /></span>
                <FileIcon name={r.file} size="sm" />
                <span className="u-truncate">{baseName(r.file)}</span>
                {dirName(r.file) ? <span className="tab__dir u-truncate">{dirName(r.file)}</span> : null}
                <span className="cv-badge cv-badge--count">{r.matches.length}</span>
              </div>
              {!isCollapsed ? r.matches.map((m, i) => {
                const key = `${r.file}:${i}`;
                return (
                  <div key={key} className={`search__match ${active === key ? 'is-active' : ''}`} role="treeitem" aria-selected={active === key} onClick={() => goTo(r.file, m, key)} title={`Line ${m.line}, Col ${m.col}`}>
                    <span className="search__ln">{m.line}</span>
                    {renderLine(m)}
                    {showReplace ? <IconButton size="sm" label="Replace" onClick={(e) => { e.stopPropagation(); applyReplace(r.file, m); }}><Replace /></IconButton> : null}
                  </div>
                );
              }) : null}
            </div>
          );
        })}
        {!results.length && query && !searching && !invalidRegex ? <div className="sidebar__hint">No results found for “{query}”.</div> : null}
        {!query ? (
          <div className="sidebar__hint">
            Searches file contents across the whole project. Use <b>Aa</b> for case, <b>ab</b> for whole words and <b>.*</b> for regular expressions.
            {activeTab ? <div style={{ marginTop: 6 }}><Button size="sm" variant="ghost" onClick={() => editorRef.current?.openSearch?.()}>Find in current file instead</Button></div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, X, Trash2, Square, Send, Copy, Check, FileCode2, TextCursorInput, Replace, FileText, RotateCcw, Wand2, MessageSquareText, Braces, TestTube2, BookOpen, AlertTriangle, ArrowDown, ArrowUpRight, Bug } from 'lucide-react';
import { IconButton, Button, Kbd, Chip, useToast, Tooltip } from '../../ui';
import { useWorkspace } from '../WorkspaceContext';
import { useAi } from './AiContext';
import { baseName, languageLabel } from '../../lib/fileTypes';
import FileIcon from '../FileIcon';
import { SHORTCUTS } from '../commands.jsx';

const ACTION_ICONS = { fix: Wand2, explain: MessageSquareText, refactor: Braces, tests: TestTube2, docs: BookOpen };

/* ---------- Markdown-lite renderer (paragraphs, lists, headings, inline code/bold, fenced code) ---------- */
function parseBlocks(text) {
  const blocks = [];
  const re = /```([\w+#.-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) blocks.push({ type: 'text', text: text.slice(last, m.index) });
    blocks.push({ type: 'code', lang: m[1] || '', code: m[2].replace(/\n$/, ''), closed: text.slice(m.index + m[0].length - 3, m.index + m[0].length) === '```' });
    last = m.index + m[0].length;
  }
  if (last < text.length) blocks.push({ type: 'text', text: text.slice(last) });
  return blocks;
}

function inline(text) {
  // split by `code` and **bold**
  const parts = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) parts.push(<code key={m.index}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('**')) parts.push(<strong key={m.index}>{tok.slice(2, -2)}</strong>);
    else parts.push(<em key={m.index}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function TextBlock({ text }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => { if (para.length) { out.push(<p key={out.length}>{inline(para.join(' '))}</p>); para = []; } };
  const flushList = () => { if (list) { const Tag = list.ordered ? 'ol' : 'ul'; out.push(<Tag key={out.length}>{list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</Tag>); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    const li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (h) { flushPara(); flushList(); out.push(<h4 key={out.length}>{inline(h[2])}</h4>); continue; }
    if (li) { flushPara(); const ordered = /^\s*\d/.test(line); if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; } list.items.push(li[1]); continue; }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return <>{out}</>;
}

/* ---------- Code block with apply actions ---------- */
function CodeBlock({ code, lang, streaming }) {
  const ws = useWorkspace();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const ed = ws.editorRef.current;
  const hasEditor = !!ws.activeTab;
  const hasSel = ws.cursorStore.use((s) => s.hasSelection);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  const need = () => { if (!ws.editorRef.current) { toast({ kind: 'warn', title: 'Open a file first', description: 'Apply actions target the active editor.' }); return null; } return ws.editorRef.current; };
  const preview = ws.settings?.aiDiffPreview !== false;
  const apply = () => {
    const e = need(); if (!e) return;
    if (preview && e.previewChanges) {
      const n = e.previewChanges(code);
      toast(n > 0 ? { kind: 'ai', title: `${n} change${n === 1 ? '' : 's'} to review`, description: 'Accept or reject them in the editor.', duration: 2200 } : { kind: 'info', title: 'No changes', description: 'The file already matches this code.', duration: 1500 });
    } else { e.replaceAll(code); toast({ kind: 'ai', title: 'Applied to file', description: baseName(ws.activeTab), duration: 1800 }); }
  };
  const insert = () => { const e = need(); if (!e) return; e.insertAtCursor(code); };
  const replaceSel = () => {
    const e = need(); if (!e) return;
    if (preview && e.previewChanges) { const r = e.getSelectionRange(); const n = e.previewChanges(code, { from: r.from, to: r.to }); if (n > 0) toast({ kind: 'ai', title: 'Review the change', description: 'Accept or reject it in the editor.', duration: 2000 }); }
    else { e.replaceSelection(code); toast({ kind: 'ai', title: 'Selection replaced', duration: 1500 }); }
  };
  const newFile = () => { ws.openDialog('newFile', { content: code, suggestedExt: lang }); };
  void ed;
  return (
    <div className="codeblock">
      <div className="codeblock__head">
        <span className="codeblock__lang">{lang || 'code'}</span>
        <IconButton size="sm" label={copied ? 'Copied' : 'Copy'} onClick={copy}>{copied ? <Check /> : <Copy />}</IconButton>
      </div>
      <pre><code>{code}{streaming ? <span className="msg__cursor" /> : null}</code></pre>
      {!streaming ? (
        <div className="codeblock__apply">
          <Button size="sm" variant="ai" icon={<FileCode2 />} onClick={apply} disabled={!hasEditor} tooltip={preview ? "Apply to the file as a reviewable diff" : "Replace the whole file with this code"}>Apply</Button>
          <Button size="sm" variant="ghost" icon={<TextCursorInput />} onClick={insert} disabled={!hasEditor} tooltip="Insert at cursor">Insert</Button>
          <Button size="sm" variant="ghost" icon={<Replace />} onClick={replaceSel} disabled={!hasEditor || !hasSel} tooltip="Replace selection">Replace selection</Button>
          <Button size="sm" variant="ghost" icon={<FileText />} onClick={newFile} tooltip="Create a new file with this code">New file</Button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Message ---------- */
function Message({ m }) {
  const ai = useAi();
  const { currentUser } = useWorkspace();
  const blocks = useMemo(() => (m.role === 'assistant' ? parseBlocks(m.content || '') : null), [m.content, m.role]);
  const Icon = m.role === 'user' && m.context?.action ? ACTION_ICONS[m.context.action] : null;
  return (
    <div className={`msg msg--${m.role === 'user' ? 'user' : 'ai'}`}>
      <span className="msg__avatar">{m.role === 'user' ? (currentUser.name || 'U').slice(0, 1).toUpperCase() : <Sparkles />}</span>
      <div className="msg__body">
        <div className="msg__meta">
          <span className="who">{m.role === 'user' ? 'You' : 'Codev AI'}</span>
          {m.role === 'user' && m.context?.fileName ? (
            <span className="ctx" title={m.context.fileName}>
              {Icon ? <Icon /> : <FileIcon name={m.context.fileName} size="sm" />}
              {baseName(m.context.fileName)}
              {m.context.isSelection && m.context.selectionLines ? `:${m.context.selectionLines.from}-${m.context.selectionLines.to}` : ''}
            </span>
          ) : null}
          {m.legacy ? <span className="ctx">legacy endpoint</span> : null}
          {m.stopped ? <span className="ctx">stopped</span> : null}
          <span className="actions">
            {m.role === 'assistant' && !m.streaming ? <IconButton size="sm" label="Regenerate" onClick={() => ai.retry(m.id)}><RotateCcw /></IconButton> : null}
            {m.content ? <IconButton size="sm" label="Copy" onClick={() => navigator.clipboard.writeText(m.content)}><Copy /></IconButton> : null}
          </span>
        </div>
        {m.role === 'user' ? (
          <div className="msg__text">{m.content}</div>
        ) : m.error ? (
          <div className="msg__error"><AlertTriangle style={{ width: 14, height: 14, flex: 'none' }} /><span style={{ flex: 1 }}>{m.error}</span><Button size="sm" variant="ghost" onClick={() => ai.retry(m.id)}>Retry</Button></div>
        ) : !m.content && m.streaming ? (
          <div className="msg__thinking" aria-label="Thinking"><i /><i /><i /></div>
        ) : (
          <div className="msg__text">
            {blocks.map((b, i) =>
              b.type === 'code' ? <CodeBlock key={i} code={b.code} lang={b.lang} streaming={m.streaming && i === blocks.length - 1 && !b.closed} /> : <TextBlock key={i} text={b.text} />
            )}
            {m.streaming && blocks[blocks.length - 1]?.type !== 'code' ? <span className="msg__cursor" /> : null}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Panel ---------- */
/** 'openai/gpt-oss-120b' → 'gpt-oss 120b' */
function shortModel(id) {
  if (!id) return 'AI';
  return id.split('/').pop().replace(/-(\d+b)$/i, ' $1').replace(/-versatile|-instant/g, '');
}

export default function AiPanel({ width }) {
  const ws = useWorkspace();
  const ai = useAi();
  const { activeTab, toggleAi, cursorStore, problems, layout } = ws;
  const cursor = cursorStore.use();
  const [draft, setDraft] = useState('');
  const [useSelection, setUseSelection] = useState(true);
  const threadRef = useRef(null);
  const taRef = useRef(null);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    if (atBottom && threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [ai.messages, atBottom]);

  const wasOpen = useRef(layout.aiOpen);
  useEffect(() => {
    if (layout.aiOpen && !wasOpen.current) setTimeout(() => taRef.current?.focus(), 30);
    wasOpen.current = layout.aiOpen;
  }, [layout.aiOpen]);

  const onScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || ai.busy) return;
    ai.send(text, { preferSelection: useSelection });
    setDraft('');
    if (taRef.current) taRef.current.style.height = '40px';
  };

  const errors = problems.filter((p) => p.severity === 'error').length;

  return (
    <aside className="ai-panel" style={{ '--ai-w': `${width}px` }} aria-label="AI assistant">
      <div className="ai-panel__head">
        <span className="ai-panel__title"><Sparkles />Assistant</span>
        <Tooltip content="Model" description={`${ws.capabilities?.models?.chat || 'default model'} via Groq`}><span className="cv-badge cv-badge--ai ai-panel__model">{shortModel(ws.capabilities?.models?.chat)}</span></Tooltip>
        <span className="u-grow" />
        {ai.busy ? <IconButton size="sm" label="Stop generating" onClick={ai.stop}><Square /></IconButton> : null}
        <IconButton size="sm" label="Clear conversation" onClick={ai.clear} disabled={!ai.messages.length}><Trash2 /></IconButton>
        <IconButton size="sm" label="Close" shortcut={SHORTCUTS.ai} onClick={toggleAi}><X /></IconButton>
      </div>

      <div className="ai-context">
        <div className="ai-context__row">
          <FileText />
          {activeTab ? (<><span>Working on:</span><span className="file" title={activeTab}>{activeTab}</span><span className="u-muted">· {languageLabel(activeTab)}</span></>) : <span>No file open — responses will be general.</span>}
        </div>
        {activeTab ? (
          <div className="ai-context__row">
            <TextCursorInput />
            {cursor.hasSelection ? (
              <span className="sel">Selected code: {cursor.selLines} line{cursor.selLines === 1 ? '' : 's'} ({cursor.selChars} chars)</span>
            ) : (
              <span>Whole file in context · Ln {cursor.line}, Col {cursor.col}</span>
            )}
            {errors ? <span className="u-muted">· {errors} error{errors === 1 ? '' : 's'} in Problems</span> : null}
          </div>
        ) : null}
      </div>

      <div className="ai-actions" role="toolbar" aria-label="Quick actions">
        {ai.actions.map((a) => {
          const Icon = ACTION_ICONS[a.id];
          return (
            <Chip key={a.id} ai icon={<Icon />} onClick={() => ai.runAction(a.id)} disabled={!activeTab || ai.busy}>{a.label}</Chip>
          );
        })}
      </div>

      <div className="ai-thread" ref={threadRef} onScroll={onScroll} aria-live="polite">
        {ai.messages.length === 0 ? (
          <div className="ai-thread__empty">
            <Sparkles />
            <h3>Your pair programmer</h3>
            <p>Ask about the open file, request changes, generate tests or docs. Code from answers can be applied straight into the editor.</p>
            <div className="ai-thread__suggest">
              {activeTab ? (
                <>
                  <button type="button" onClick={() => ai.runAction('explain')}><MessageSquareText />Explain what {baseName(activeTab)} does</button>
                  <button type="button" onClick={() => ai.runAction(errors ? 'fix' : 'refactor')}>{errors ? <Bug /> : <Braces />}{errors ? `Fix the ${errors} error${errors === 1 ? '' : 's'} from the last run` : 'Suggest a cleaner structure for this file'}</button>
                  <button type="button" onClick={() => ai.runAction('tests')}><TestTube2 />Write tests for this file</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => ai.send('Write a Python function that parses a CSV string into a list of dictionaries, with tests.')}><Wand2 />Generate a snippet from a description</button>
                  <button type="button" onClick={() => ws.openPalette('files')}><ArrowUpRight />Open a file to add it as context</button>
                </>
              )}
            </div>
          </div>
        ) : (
          ai.messages.map((m) => <Message key={m.id} m={m} />)
        )}
      </div>
      {!atBottom && ai.messages.length ? (
        <div style={{ position: 'relative', height: 0 }}>
          <button type="button" className="cv-btn cv-btn--secondary cv-btn--sm" style={{ position: 'absolute', right: 12, bottom: 8, boxShadow: 'var(--shadow-2)' }} onClick={() => { setAtBottom(true); threadRef.current.scrollTop = threadRef.current.scrollHeight; }}><ArrowDown style={{ width: 12, height: 12 }} /> Latest</button>
        </div>
      ) : null}

      <div className="ai-composer">
        <div className="ai-composer__box">
          <textarea
            ref={taRef}
            value={draft}
            placeholder={activeTab ? `Ask about ${baseName(activeTab)}, or describe a change…` : 'Ask anything, or describe code to generate…'}
            onChange={(e) => { setDraft(e.target.value); e.target.style.height = '40px'; e.target.style.height = Math.min(160, e.target.scrollHeight) + 'px'; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            aria-label="Message the assistant"
            rows={1}
          />
          <div className="ai-composer__bar">
            <span className="u-grow">
              {activeTab ? (
                <span className="ai-composer__ctx" title={cursor.hasSelection && useSelection ? 'Selection is included as context' : 'Whole file is included as context'}>
                  <FileIcon name={activeTab} size="sm" />
                  <span className="u-truncate">{baseName(activeTab)}{cursor.hasSelection && useSelection ? ` · ${cursor.selLines} lines` : ''}</span>
                  {cursor.hasSelection ? <button type="button" aria-label={useSelection ? 'Use whole file instead' : 'Use selection'} onClick={() => setUseSelection((s) => !s)} title={useSelection ? 'Use whole file' : 'Use selection'}><X /></button> : null}
                </span>
              ) : null}
            </span>
            {ai.busy ? (
              <Button size="sm" variant="ghost" icon={<Square />} onClick={ai.stop}>Stop</Button>
            ) : (
              <Button size="sm" variant="ai-solid" icon={<Send />} onClick={submit} disabled={!draft.trim()}>Send</Button>
            )}
          </div>
        </div>
        <div className="ai-composer__hint">
          <span><Kbd keys={['Enter']} /> send</span>
          <span><Kbd keys={['Shift', 'Enter']} /> newline</span>
          <span><Kbd combo={SHORTCUTS.inlineAi} /> inline edit</span>
        </div>
      </div>
    </aside>
  );
}

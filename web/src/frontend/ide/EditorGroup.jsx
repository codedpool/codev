'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronRight, MoreHorizontal, FilePlus, FolderOpen, Sparkles, Check, RotateCcw, Loader2, AlertTriangle, Play, WrapText, Map as MapIcon } from 'lucide-react';
import CodeEditor from '../editor/CodeEditor';
import { IconButton, Menu, useMenu, Button, Kbd, Avatar, Skeleton, Tooltip, useToast, Dot } from '../ui';
import { useWorkspace } from './WorkspaceContext';
import { usePresence } from './PresenceContext';
import { useAi } from './ai/AiContext';
import FileIcon from './FileIcon';
import { baseName, dirName, languageLabel, isRunnable } from '../lib/fileTypes';
import { aiAutoComplete } from '../lib/api';
import { LogoMark } from '../ui/Logo';
import { SHORTCUTS } from './commands.jsx';
import { colorFor } from '../lib/colors';

/* ---------------- Tabs ---------------- */
function EditorTabs() {
  const ws = useWorkspace();
  const { tabs, activeTab, setActiveTab, closeTab, closeTabs, moveTab, dirty, openDialog, toggleSidebar, setExpandedDirs, run } = ws;
  const presence = usePresence();
  const menu = useMenu();
  const scrollRef = useRef(null);
  const [drag, setDrag] = useState(null); // index
  const [over, setOver] = useState(null);

  useEffect(() => {
    const el = scrollRef.current?.querySelector('.tab.is-active');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  const nameCounts = useMemo(() => {
    const m = new Map();
    tabs.forEach((t) => m.set(baseName(t), (m.get(baseName(t)) || 0) + 1));
    return m;
  }, [tabs]);
  const presenceByFile = useMemo(() => {
    const m = new Map();
    presence.others.forEach((o) => { if (o.file) m.set(o.file, [...(m.get(o.file) || []), o]); });
    return m;
  }, [presence.others]);

  const revealInExplorer = (path) => {
    toggleSidebar('explorer');
    const dir = dirName(path);
    if (dir) {
      const parts = dir.split('/');
      setExpandedDirs((ed) => Array.from(new Set([...ed, ...parts.map((_, i) => parts.slice(0, i + 1).join('/'))])));
    }
  };

  const items = useMemo(() => {
    const p = menu.data;
    if (!p) return [];
    const idx = tabs.indexOf(p);
    return [
      { label: 'Close', shortcut: SHORTCUTS.closeTab, onSelect: () => closeTab(p) },
      { label: 'Close others', onSelect: () => closeTabs(tabs.filter((t) => t !== p)), disabled: tabs.length < 2 },
      { label: 'Close to the right', onSelect: () => closeTabs(tabs.slice(idx + 1)), disabled: idx >= tabs.length - 1 },
      { label: 'Close saved', onSelect: () => closeTabs(tabs.filter((t) => !dirty.has(t))) },
      { label: 'Close all', onSelect: () => closeTabs(tabs) },
      { separator: true },
      ...(isRunnable(p) ? [{ label: 'Run', icon: <Play />, onSelect: () => { setActiveTab(p); setTimeout(() => run(p), 30); } }] : []),
      { label: 'Reveal in explorer', onSelect: () => revealInExplorer(p) },
      { label: 'Rename…', onSelect: () => openDialog('rename', { path: p }) },
      { label: 'Copy path', onSelect: () => navigator.clipboard.writeText(p) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu.data, tabs, dirty]);

  const onWheel = (e) => {
    if (scrollRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) scrollRef.current.scrollLeft += e.deltaY;
  };

  return (
    <div className="tabs" role="tablist" aria-label="Open editors">
      <div className="tabs__scroll" ref={scrollRef} onWheel={onWheel}>
        {tabs.map((t, i) => {
          const isActive = t === activeTab;
          const isDirty = dirty.has(t);
          const who = presenceByFile.get(t);
          const showDir = nameCounts.get(baseName(t)) > 1 && dirName(t);
          return (
            <div
              key={t}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={`tab ${isActive ? 'is-active' : ''} ${isDirty ? 'is-dirty' : ''} ${drag === i ? 'is-dragging' : ''} ${over === i && drag !== null && drag !== i ? 'is-drop-before' : ''}`}
              onClick={() => setActiveTab(t)}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(t); } }}
              onContextMenu={(e) => menu.openAt(e, t)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') setActiveTab(tabs[(i + 1) % tabs.length]);
                else if (e.key === 'ArrowLeft') setActiveTab(tabs[(i - 1 + tabs.length) % tabs.length]);
                else if (e.key === 'Delete' || e.key === 'Backspace') closeTab(t);
              }}
              draggable
              onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t); }}
              onDragOver={(e) => { e.preventDefault(); setOver(i); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); if (drag !== null && drag !== i) moveTab(drag, i); setDrag(null); setOver(null); }}
              onDragEnd={() => { setDrag(null); setOver(null); }}
              title={t}
            >
              <FileIcon name={t} size="sm" />
              <span className="tab__name">{baseName(t)}{showDir ? <span className="tab__dir"> {dirName(t)}</span> : null}</span>
              {who?.length ? <span className="tab__presence">{who.slice(0, 2).map((o) => <Avatar key={o.id} name={o.name} color={o.color} src={o.avatar} size="sm" />)}</span> : null}
              {isDirty ? <span className="tab__dirty" aria-label="Unsaved changes" /> : null}
              <button type="button" className="tab__close" aria-label={`Close ${baseName(t)}`} onClick={(e) => { e.stopPropagation(); closeTab(t); }} tabIndex={-1}><X /></button>
            </div>
          );
        })}
      </div>
      <div className="tabs__actions">
        <IconButton size="sm" label="Toggle word wrap" active={ws.settings.wordWrap} onClick={() => ws.setSettings({ wordWrap: !ws.settings.wordWrap })}><WrapText /></IconButton>
        <IconButton size="sm" label="Toggle minimap" active={ws.settings.minimap} onClick={() => ws.setSettings({ minimap: !ws.settings.minimap })}><MapIcon /></IconButton>
        <IconButton size="sm" label="More actions" onClick={(e) => menu.openAt(e.currentTarget, activeTab)} disabled={!activeTab}><MoreHorizontal /></IconButton>
      </div>
      <Menu open={menu.open} anchor={menu.anchor} items={items} onClose={menu.close} align="end" />
    </div>
  );
}

/* ---------------- Breadcrumbs ---------------- */
function Breadcrumbs({ file, syncStatus }) {
  const { project, toggleSidebar, setExpandedDirs, cursorStore, openPalette } = useWorkspace();
  const presence = usePresence();
  const parts = file.split('/');
  const dirs = parts.slice(0, -1);
  const who = presence.others.filter((o) => o.file === file);
  const cursor = cursorStore.use();
  const reveal = (i) => {
    toggleSidebar('explorer');
    const path = dirs.slice(0, i + 1).join('/');
    setExpandedDirs((ed) => Array.from(new Set([...ed, ...dirs.slice(0, i + 1).map((_, j) => dirs.slice(0, j + 1).join('/'))])));
    void path;
  };
  const syncTone = syncStatus === 'synced' ? 'success' : syncStatus === 'offline' ? 'danger' : syncStatus === 'local' ? undefined : 'warn';
  const syncLabel = { synced: 'Synced', connecting: 'Syncing', offline: 'Offline', local: 'Local' }[syncStatus] || syncStatus;
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <button type="button" className="crumbs__item" onClick={() => toggleSidebar('explorer')}>{project?.projectName || 'project'}</button>
      {dirs.map((d, i) => (
        <React.Fragment key={i}>
          <span className="crumbs__sep"><ChevronRight /></span>
          <button type="button" className="crumbs__item" onClick={() => reveal(i)}>{d}</button>
        </React.Fragment>
      ))}
      <span className="crumbs__sep"><ChevronRight /></span>
      <button type="button" className="crumbs__item crumbs__item--file" onClick={() => openPalette('symbols')}>
        <FileIcon name={file} size="sm" />
        {parts[parts.length - 1]}
      </button>
      <span className="crumbs__spacer" />
      <span className="crumbs__meta">
        {who.length ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{who.slice(0, 3).map((o) => <Avatar key={o.id} name={o.name} color={o.color} src={o.avatar} size="sm" title={`${o.name}${o.line ? ` · line ${o.line}` : ''}`} />)}<span>{who.length === 1 ? `${who[0].name} is here` : `${who.length} others here`}</span></span> : null}
        {cursor.selChars ? <span>{cursor.selChars} chars selected</span> : null}
        <span>{languageLabel(file)}</span>
        <Tooltip content={syncStatus === 'local' ? 'Collaboration not configured' : `Document ${syncLabel.toLowerCase()}`}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Dot tone={syncTone} pulse={syncStatus === 'connecting'} />{syncLabel}</span></Tooltip>
      </span>
    </nav>
  );
}

/* ---------------- Inline AI widget ---------------- */
function InlineAi({ file, hostRef }) {
  const ws = useWorkspace();
  const ai = useAi();
  const { toast } = useToast();
  const [state, setState] = useState(null); // {top,left, from,to, code, phase, instruction, result, error}
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const open = useCallback(() => {
    const ed = ws.editorRef.current;
    if (!ed || ed.file !== file) return;
    const range = ed.getSelectionRange();
    const code = ed.getSelectionText();
    const coords = ed.selectionCoords();
    const host = hostRef.current?.getBoundingClientRect();
    const anchor = coords.end || coords.head;
    let top = 40;
    let left = 60;
    if (anchor && host) {
      top = Math.min(host.height - 140, Math.max(8, anchor.bottom - host.top + 6));
      left = Math.min(host.width - 540, Math.max(48, (coords.start?.left ?? anchor.left) - host.left));
    }
    setState({ top, left, from: range.from, to: range.to, code, phase: 'input', instruction: '', result: null, error: null });
    setTimeout(() => inputRef.current?.focus(), 20);
  }, [file, hostRef, ws.editorRef]);

  useEffect(() => {
    const onEvt = () => open();
    window.addEventListener('cv:inline-ai', onEvt);
    return () => window.removeEventListener('cv:inline-ai', onEvt);
  }, [open]);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setState(null);
    ws.editorRef.current?.focus();
  }, [ws.editorRef]);

  const submit = async () => {
    if (!state?.instruction.trim()) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState((s) => ({ ...s, phase: 'loading', error: null }));
    try {
      const result = await ai.requestCode(state.instruction, { code: state.code, fileName: file, signal: ctrl.signal });
      setState((s) => (s ? { ...s, phase: 'preview', result } : s));
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setState((s) => (s ? { ...s, phase: 'input', error: e.message || 'AI request failed' } : s));
    }
  };

  const accept = () => {
    const ed = ws.editorRef.current;
    if (!ed || !state?.result) return;
    if (ws.settings.aiDiffPreview !== false && state.code && ed.previewChanges) {
      const n = ed.previewChanges(state.result, { from: state.from, to: state.to });
      if (n > 0) toast({ kind: 'ai', title: 'Review the AI edit', description: 'Accept or reject each change inline.', duration: 2200 });
    } else if (state.code) ed.replaceRange(state.from, state.to, state.result);
    else ed.insertAtCursor(state.result);
    if (ws.settings.aiDiffPreview === false || !state.code) toast({ kind: 'ai', title: 'Applied AI edit', description: baseName(file), duration: 1800 });
    setState(null);
  };

  if (!state) return null;
  const oldLines = state.code ? state.code.split('\n').length : 0;
  const newLines = state.result ? state.result.split('\n').length : 0;
  return (
    <div className="inline-ai" style={{ top: state.top, left: state.left }} role="dialog" aria-label="Ask AI" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <div className="inline-ai__row">
        {state.phase === 'loading' ? <Loader2 style={{ animation: 'cv-spin 0.9s linear infinite' }} /> : <Sparkles />}
        <input
          ref={inputRef}
          value={state.instruction}
          disabled={state.phase === 'loading'}
          placeholder={state.code ? 'Ask AI to modify the selected code…' : 'Ask AI to write code here…'}
          onChange={(e) => setState((s) => ({ ...s, instruction: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (state.phase === 'preview') accept(); else submit(); }
          }}
        />
        {state.phase === 'loading' ? <Button size="sm" variant="ghost" onClick={() => { abortRef.current?.abort(); setState((s) => ({ ...s, phase: 'input' })); }}>Cancel</Button> : <Button size="sm" variant="ai-solid" onClick={submit} disabled={!state.instruction.trim()}>{state.phase === 'preview' ? 'Regenerate' : 'Generate'}</Button>}
        <IconButton size="sm" label="Close" onClick={close} tooltipDisabled><X /></IconButton>
      </div>
      <div className="inline-ai__meta">
        {state.code ? <span>Selection: {oldLines} line{oldLines === 1 ? '' : 's'}</span> : <span>Insert at cursor</span>}
        <span>·</span><span>{baseName(file)}</span>
        {state.error ? <span style={{ color: 'var(--danger)', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle style={{ width: 12, height: 12 }} />{state.error}</span> : <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}><Kbd keys={['Enter']} /> {state.phase === 'preview' ? 'accept' : 'generate'} <Kbd keys={['Esc']} /> dismiss</span>}
      </div>
      {state.phase === 'preview' && state.result != null ? (
        <>
          <div className="inline-ai__preview"><pre>{state.result || '(empty)'}</pre></div>
          <div className="inline-ai__foot">
            <span className="u-grow"><span className="inline-ai__diff">{state.code ? <span className="del">−{oldLines}</span> : null}<span className="add">+{newLines}</span></span> lines</span>
            <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => setState((s) => ({ ...s, phase: 'input' }))}>Edit prompt</Button>
            <Button size="sm" variant="ghost" onClick={close}>Reject</Button>
            <Button size="sm" variant="ai-solid" icon={<Check />} onClick={accept}>Accept</Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ---------------- Editor pane ---------------- */
function EditorPane({ file }) {
  const ws = useWorkspace();
  const { projectId, settings, currentUser, handleContentChange, handleLoaded, cursorStore, editorRef, saveFile, setSyncStatus, syncStatus, closeTab, createFile, getContent, contentsRef, problems } = ws;
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const hostRef = useRef(null);
  const [tick, setTick] = useState(0);

  const loadContent = useCallback(async () => {
    // Prefer the in-memory buffer (unsaved edits survive tab switches even in local mode)
    if (contentsRef.current.has(file)) return contentsRef.current.get(file);
    return getContent(file);
  }, [file, getContent, contentsRef]);

  const onLoaded = useCallback((content) => {
    if (content == null) { setLoadState('error'); return; }
    handleLoaded(file, content);
    setLoadState('ready');
  }, [file, handleLoaded]);

  const [ready, setReady] = useState(0);
  const onReady = useCallback((api) => { editorRef.current = { ...api, file }; setReady((n) => n + 1); }, [editorRef, file]);
  // Mirror run problems for this file into the gutter / squiggles
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || ed.file !== file || loadState !== 'ready') return;
    ed.setDiagnostics?.(problems.filter((p) => p.file === file));
  }, [problems, file, editorRef, ready, loadState]);
  const onDestroy = useCallback(() => { if (editorRef.current?.file === file) editorRef.current = null; }, [editorRef, file]);
  const onChange = useCallback((content) => handleContentChange(file, content), [file, handleContentChange]);
  const onCursor = useCallback((c) => cursorStore.set(c), [cursorStore]);
  const onSave = useCallback(() => saveFile(file), [file, saveFile]);
  const fetchSuggestion = useCallback((payload, signal) => aiAutoComplete({ ...payload, code: payload.prefix, language: languageLabel(file) }, signal), [file]);
  const user = useMemo(() => ({ name: currentUser.name, color: colorFor(currentUser.id || currentUser.name) }), [currentUser]);
  const [review, setReview] = useState({ active: false, chunks: 0 });
  const onReview = useCallback((r) => setReview(r), []);

  const editor = (
    <CodeEditor
      key={`${file}-${tick}`}
      projectId={projectId}
      fileName={file}
      loadContent={loadContent}
      settings={settings}
      user={user}
      onChange={onChange}
      onLoaded={onLoaded}
      onCursor={onCursor}
      onSyncStatus={setSyncStatus}
      onReady={onReady}
      onDestroy={onDestroy}
      fetchSuggestion={fetchSuggestion}
      onSave={onSave}
      onReview={onReview}
    />
  );

  return (
    <>
      <Breadcrumbs file={file} syncStatus={syncStatus} />
      <div ref={hostRef} className={`editor-wrap ${loadState === 'loading' ? 'is-loading' : ''}`}>
        {editor}
        {loadState === 'loading' ? (
          <div className="editor-skeleton" aria-hidden>
            {[62, 40, 78, 55, 30, 70, 48, 66, 36].map((w, i) => <Skeleton key={i} width={`${w}%`} />)}
          </div>
        ) : null}
        {loadState === 'error' ? (
          <div className="editor-empty" style={{ position: 'absolute', inset: 0 }}>
            <div className="editor-empty__inner">
              <AlertTriangle style={{ width: 22, height: 22, color: 'var(--warn)', marginBottom: 8 }} />
              <div className="editor-empty__title">Couldn’t open {baseName(file)}</div>
              <div className="editor-empty__desc">The file wasn’t found in this project. It may have been deleted or the link is out of date.</div>
              <div className="editor-empty__actions">
                <Button variant="primary" onClick={async () => { try { await createFile(file, ''); setLoadState('loading'); setTick((t) => t + 1); } catch (e) { void e; } }}>Create it</Button>
                <Button onClick={() => { setLoadState('loading'); setTick((t) => t + 1); }}>Retry</Button>
                <Button variant="ghost" onClick={() => closeTab(file)}>Close tab</Button>
              </div>
            </div>
          </div>
        ) : null}
        {review.active ? <ReviewBar file={file} chunks={review.chunks} /> : null}
        <InlineAi file={file} hostRef={hostRef} />
      </div>
    </>
  );
}

/* ---------------- AI review bar (accept / reject a previewed edit) ---------------- */
function ReviewBar({ file, chunks }) {
  const { editorRef } = useWorkspace();
  const { toast } = useToast();
  const ed = () => (editorRef.current?.file === file ? editorRef.current : null);
  const acceptAll = () => { ed()?.acceptAll(); toast({ kind: 'ai', title: 'AI edit applied', description: baseName(file), duration: 1500 }); };
  const rejectAll = () => { ed()?.rejectAll(); toast({ kind: 'info', title: 'AI edit discarded', duration: 1500 }); };
  useEffect(() => {
    const onKey = (e) => {
      if (!ed()) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); e.stopPropagation(); acceptAll(); }
      else if (e.key === 'Escape' && e.shiftKey) { e.preventDefault(); rejectAll(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  return (
    <div className="review-bar" role="toolbar" aria-label="Review AI edit">
      <Sparkles className="review-bar__icon" />
      <span className="review-bar__text"><b>AI edit</b> · {chunks} change{chunks === 1 ? '' : 's'} pending — review inline or</span>
      <Button size="sm" variant="ghost" onClick={() => ed()?.nextChunk()} tooltip="Jump to next change">Next</Button>
      <Button size="sm" variant="ghost" icon={<X />} onClick={rejectAll} tooltip="Discard all changes (Shift+Esc)">Reject all</Button>
      <Button size="sm" variant="ai-solid" icon={<Check />} onClick={acceptAll} tooltip="Keep all changes (Ctrl+Shift+Enter)">Accept all</Button>
    </div>
  );
}

/* ---------------- Empty state ---------------- */
function EmptyEditor() {
  const { openDialog, openPalette, files, openFile, projectStatus } = useWorkspace();
  const recent = files.slice(0, 5);
  return (
    <div className="editor-empty">
      <div className="editor-empty__grid" aria-hidden />
      <div className="editor-empty__inner">
        <div className="editor-empty__mark"><LogoMark size={40} /></div>
        <div className="editor-empty__title">Ready when you are.</div>
        <div className="editor-empty__desc">Open a file from the explorer, or create something new.</div>
        <div className="editor-empty__actions">
          <Button variant="primary" icon={<FilePlus />} onClick={() => openDialog('newFile')}>Create file</Button>
          <Button icon={<FolderOpen />} onClick={() => openPalette('files')} disabled={projectStatus === 'loading'}>Open file</Button>
        </div>
        {recent.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 14 }}>
            {recent.map((f) => (
              <button key={f} type="button" className="cv-chip" onClick={() => openFile(f)}><FileIcon name={f} size="sm" />{baseName(f)}</button>
            ))}
          </div>
        ) : null}
        <div className="editor-empty__keys">
          <span>Go to file</span><span><Kbd combo={SHORTCUTS.quickOpen} /></span>
          <span>Command palette</span><span><Kbd combo={SHORTCUTS.palette} /></span>
          <span>Run code</span><span><Kbd combo={SHORTCUTS.run} /></span>
          <span>Ask AI</span><span><Kbd combo={SHORTCUTS.ai} /></span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Group ---------------- */
export default function EditorGroup() {
  const { activeTab, tabs, reloadRevision } = useWorkspace();
  return (
    <div className="ide__editor-area">
      {tabs.length ? <EditorTabs /> : null}
      {activeTab ? <EditorPane key={`${activeTab}-${reloadRevision}`} file={activeTab} /> : <EmptyEditor />}
    </div>
  );
}

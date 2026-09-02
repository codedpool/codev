'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Maximize2, Minimize2, Trash2, Play, Square, AlertCircle, AlertTriangle, Info, Sparkles, FileText, Copy, Filter } from 'lucide-react';
import { IconButton, Button, Dot, EmptyState, useToast, Kbd } from '../../ui';
import { useWorkspace } from '../WorkspaceContext';
import { useAi } from '../ai/AiContext';
import { baseName, isRunnable, runCommandFor } from '../../lib/fileTypes';
import { SHORTCUTS } from '../commands.jsx';

const TABS = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'problems', label: 'Problems' },
  { id: 'output', label: 'Output' },
  { id: 'debug', label: 'Debug Console' },
];

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Colourise typical error/warning/success lines in program output. */
function colorize(text) {
  return text.split('\n').map((line, i) => {
    let cls = '';
    if (/error|exception|traceback|fatal|failed|undefined reference|cannot find|not found/i.test(line)) cls = 'hl-err';
    else if (/warn/i.test(line)) cls = 'hl-warn';
    else if (/^(ok|passed|success|done)\b/i.test(line)) cls = 'hl-ok';
    return (
      <React.Fragment key={i}>
        {cls ? <span className={cls}>{line}</span> : line}
        {'\n'}
      </React.Fragment>
    );
  });
}

/* ---------------- Terminal ---------------- */
function TerminalTab() {
  const ws = useWorkspace();
  const { sessions, isRunning, run, stop, activeTab, stdin, setStdin, project, clearSessions, capabilities } = ws;
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const [stick, setStick] = useState(true);

  useEffect(() => {
    if (stick && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [sessions, isRunning, stick]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
  };

  const canRun = activeTab && isRunnable(activeTab);
  const cwd = `~/${(project?.projectName || 'workspace').toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="term">
      <div className="term__scroll" ref={scrollRef} onScroll={onScroll} onClick={() => taRef.current?.focus()}>
        <div className="term__banner">
          Codev runner{capabilities?.runner && capabilities.runner !== 'unknown' ? ` (${capabilities.runner})` : ''} · <b>{project?.projectName || 'workspace'}</b>{capabilities?.languages?.length ? ` · ${capabilities.languages.length} languages` : ''}
        </div>
        {sessions.length === 0 ? (
          <div className="term__prompt" style={{ color: 'var(--text-3)' }}>
            <span className="sym">❯</span>
            <span>{canRun ? <>Press <Kbd combo={SHORTCUTS.run} /> or the Run button to execute <b style={{ color: 'var(--text-2)' }}>{baseName(activeTab)}</b>.</> : 'Open a runnable file (e.g. .py, .js, .cpp, .java) to get started.'}</span>
          </div>
        ) : null}
        {sessions.map((s) => (
          <div key={s.id} className="term__session">
            <div className="term__prompt">
              <span className="sym">❯</span>
              <span className="cwd">{cwd}</span>
              <span className="cmd">{s.command}</span>
              <span className="time">{fmtTime(s.startedAt)}</span>
            </div>
            {s.stdin ? <div className="term__stdin-line"><span className="sym">stdin ›</span><span style={{ whiteSpace: 'pre-wrap' }}>{s.stdin}</span></div> : null}
            {s.status === 'running' ? (
              <div className="term__running"><span className="term__caret" /> running…</div>
            ) : (
              <>
                {s.output ? <pre className={`term__out ${s.status === 'error' ? 'is-error' : ''}`}>{colorize(s.output.replace(/\n$/, ''))}</pre> : null}
                {s.error ? <pre className="term__out is-error">{s.error}</pre> : null}
                {!s.output && !s.error ? <pre className="term__out" style={{ color: 'var(--text-4)' }}>(no output)</pre> : null}
                <div className="term__exit">
                  <Dot tone={s.status === 'done' ? 'success' : s.status === 'stopped' ? undefined : 'danger'} />
                  {s.status === 'done' ? 'exited normally' : s.status === 'stopped' ? 'stopped' : 'exited with errors'}
                  {s.endedAt ? <span>· {s.endedAt - s.startedAt}ms</span> : null}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="term__input">
        <span className="sym">❯</span>
        <span className="label">stdin</span>
        <textarea
          ref={taRef}
          rows={1}
          value={stdin}
          placeholder={canRun ? 'Program input (Enter to run, Shift+Enter for a new line)' : 'Program input for the next run'}
          onChange={(e) => { setStdin(e.target.value); e.target.style.height = '20px'; e.target.style.height = Math.min(96, e.target.scrollHeight) + 'px'; }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canRun && !isRunning) run(); }
            if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); clearSessions(); }
          }}
          aria-label="Standard input"
        />
        <span className="hint">{isRunning ? 'running' : canRun ? 'Enter ↵ runs' : ''}</span>
        {isRunning ? <Button size="sm" variant="stop" icon={<Square />} onClick={stop}>Stop</Button> : <Button size="sm" variant="primary" icon={<Play />} onClick={() => run()} disabled={!canRun}>Run</Button>}
      </div>
    </div>
  );
}

/* ---------------- Problems ---------------- */
function ProblemsTab() {
  const { problems, openFile, editorRef, clearProblems } = useWorkspace();
  const ai = useAi();
  const [filter, setFilter] = useState('all');
  const list = problems.filter((p) => filter === 'all' || p.severity === filter);
  const goTo = (p) => {
    openFile(p.file);
    if (p.line) {
      let tries = 0;
      const tick = () => {
        const ed = editorRef.current;
        if (ed && ed.file === p.file) { ed.revealLine(p.line); return; }
        if (tries++ < 30) setTimeout(tick, 60);
      };
      setTimeout(tick, 30);
    }
  };
  if (!problems.length) {
    return <EmptyState icon={<AlertCircle />} title="No problems detected" description="Errors from runs and AI diagnostics will appear here with jump-to-line and quick fixes." />;
  }
  return (
    <div className="problems">
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px 6px 12px', fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
        <Filter style={{ width: 12, height: 12 }} />
        {['all', 'error', 'warning'].map((f) => (
          <button key={f} type="button" className={`cv-chip ${filter === f ? 'is-active' : ''}`} style={filter === f ? { color: 'var(--text-1)', borderColor: 'var(--border-strong)', background: 'var(--bg-active)' } : undefined} onClick={() => setFilter(f)}>{f}{f !== 'all' ? ` (${problems.filter((p) => p.severity === f).length})` : ''}</button>
        ))}
        <span style={{ marginLeft: 'auto' }}><Button size="sm" variant="ghost" icon={<Sparkles />} onClick={() => ai.runAction('fix')}>Ask AI to fix all</Button></span>
      </div>
      {list.map((p) => {
        const Icon = p.severity === 'error' ? AlertCircle : p.severity === 'warning' ? AlertTriangle : Info;
        return (
          <div key={p.id} className="problem" onClick={() => goTo(p)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') goTo(p); }}>
            <span className={`problem__icon problem__icon--${p.severity}`}><Icon /></span>
            <div className="problem__body">
              <div className="problem__msg">{p.message}</div>
              <div className="problem__loc">{p.file}{p.line ? `:${p.line}` : ''} · {p.source === 'run' ? 'runner' : p.source}</div>
            </div>
            <span className="problem__actions">
              <Button size="sm" variant="ghost" icon={<FileText />} onClick={(e) => { e.stopPropagation(); goTo(p); }}>Open file</Button>
              <Button size="sm" variant="ai" icon={<Sparkles />} onClick={(e) => { e.stopPropagation(); goTo(p); setTimeout(() => ai.runAction('fix', { prompt: `Fix this error in ${p.file}${p.line ? ` (line ${p.line})` : ''}: ${p.message}\nExplain the cause briefly and provide the corrected code.` }), 150); }}>Ask AI to fix</Button>
            </span>
          </div>
        );
      })}
      <div style={{ padding: '6px 12px' }}><Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => clearProblems()}>Clear all</Button></div>
    </div>
  );
}

/* ---------------- Output ---------------- */
function OutputTab() {
  const { sessions } = useWorkspace();
  const { toast } = useToast();
  const last = sessions[sessions.length - 1];
  if (!last) return <EmptyState icon={<FileText />} title="No output yet" description="Raw output of the most recent run shows here." />;
  const text = last.output || last.error || '';
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 2 }}>
        <IconButton size="sm" label="Copy output" onClick={() => { navigator.clipboard.writeText(text); toast({ kind: 'success', title: 'Output copied', duration: 1500 }); }}><Copy /></IconButton>
      </div>
      <div className="output">
        <div style={{ color: 'var(--text-4)', marginBottom: 6 }}>{runCommandFor(last.file)} · {fmtTime(last.startedAt)}{last.endedAt ? ` · ${last.endedAt - last.startedAt}ms` : ''}</div>
        {text || <span style={{ color: 'var(--text-4)' }}>(empty)</span>}
      </div>
    </div>
  );
}

/* ---------------- Debug console ---------------- */
function DebugTab() {
  const { logs, clearLogs } = useWorkspace();
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  if (!logs.length) return <EmptyState icon={<Info />} title="Console is quiet" description="Saves, runs, AI requests and collaboration events are logged here." />;
  return (
    <div className="console" ref={ref} style={{ height: '100%', overflow: 'auto' }}>
      {logs.map((l) => (
        <div key={l.id} className="console__row">
          <span className="console__ts">{fmtTime(l.ts)}</span>
          <span className={`console__lvl console__lvl--${l.level}`}>{l.level}</span>
          <span className="console__msg">{l.message}</span>
        </div>
      ))}
      <div style={{ padding: '4px 12px' }}><Button size="sm" variant="ghost" icon={<Trash2 />} onClick={clearLogs}>Clear</Button></div>
    </div>
  );
}

/* ---------------- Panel shell ---------------- */
export default function BottomPanel({ height }) {
  const { layout, setLayout, togglePanel, problems, sessions, isRunning, clearSessions, clearProblems, clearLogs, logs } = useWorkspace();
  const tab = layout.panelTab;
  const errors = problems.filter((p) => p.severity === 'error').length;
  const warnings = problems.filter((p) => p.severity === 'warning').length;
  const counts = useMemo(() => ({ terminal: sessions.length, problems: problems.length, output: sessions.length ? 1 : 0, debug: logs.length }), [sessions.length, problems.length, logs.length]);

  const clear = () => {
    if (tab === 'terminal' || tab === 'output') clearSessions();
    else if (tab === 'problems') clearProblems();
    else clearLogs();
  };

  return (
    <section className={`panel ${layout.panelMaximized ? 'is-maximized' : ''}`} style={{ '--panel-h': `${height}px` }} aria-label="Panel">
      <div className="panel__head">
        <div className="panel__tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`panel__tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setLayout({ panelTab: t.id })}>
              {t.label}
              {t.id === 'problems' && (errors || warnings) ? <span className={`cv-badge cv-badge--count ${errors ? 'cv-badge--danger' : 'cv-badge--warn'}`}>{errors + warnings}</span> : null}
              {t.id === 'terminal' && isRunning ? <Dot tone="accent" pulse /> : null}
              {t.id === 'debug' && logs.some((l) => l.level === 'error') ? <Dot tone="danger" /> : null}
            </button>
          ))}
        </div>
        <div className="panel__actions">
          <IconButton size="sm" label="Clear" onClick={clear} disabled={!counts[tab]}><Trash2 /></IconButton>
          <IconButton size="sm" label={layout.panelMaximized ? 'Restore panel' : 'Maximize panel'} onClick={() => setLayout({ panelMaximized: !layout.panelMaximized })}>{layout.panelMaximized ? <Minimize2 /> : <Maximize2 />}</IconButton>
          <IconButton size="sm" label="Close panel" shortcut={SHORTCUTS.panel} onClick={() => togglePanel()}><X /></IconButton>
        </div>
      </div>
      <div className="panel__body" role="tabpanel">
        {tab === 'terminal' ? <TerminalTab /> : tab === 'problems' ? <ProblemsTab /> : tab === 'output' ? <OutputTab /> : <DebugTab />}
      </div>
    </section>
  );
}

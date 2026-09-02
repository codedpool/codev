'use client';
import React from 'react';
import { Play, Square, Terminal, AlertTriangle, Bug, ChevronRight, Clock } from 'lucide-react';
import { Button, SectionHeader, Textarea, Field, Select, EmptyState, Dot } from '../../ui';
import { useWorkspace } from '../WorkspaceContext';
import FileIcon from '../FileIcon';
import { baseName, isRunnable, languageLabel, runCommandFor, RUNNABLE } from '../../lib/fileTypes';

export default function RunView() {
  const ws = useWorkspace();
  const { activeTab, files, openFile, run, stop, isRunning, stdin, setStdin, sessions, togglePanel, problems, capabilities } = ws;
  const runnable = files.filter(isRunnable);
  const target = activeTab && isRunnable(activeTab) ? activeTab : runnable[0] || null;
  const recent = [...sessions].reverse().slice(0, 8);

  return (
    <div className="sidebar__body">
      <div className="sidebar__stack">
        <Field label="Run configuration">
          <Select value={target || ''} onChange={(e) => openFile(e.target.value)} disabled={!runnable.length}>
            {runnable.length ? runnable.map((f) => <option key={f} value={f}>{baseName(f)} · {languageLabel(f)}</option>) : <option value="">No runnable files</option>}
          </Select>
        </Field>
        {target ? (
          <div className="sidebar__note">
            <code style={{ color: 'var(--text-2)' }}>{runCommandFor(target)}</code>
          </div>
        ) : null}
        <Field label="Standard input" hint="Sent to the program's stdin when it runs.">
          <Textarea mono rows={3} placeholder="Input lines…" value={stdin} onChange={(e) => setStdin(e.target.value)} style={{ minHeight: 64 }} />
        </Field>
        <div style={{ display: 'flex', gap: 6 }}>
          {isRunning ? (
            <Button variant="stop" icon={<Square />} onClick={stop} block>Stop</Button>
          ) : (
            <Button variant="primary" icon={<Play />} onClick={() => { if (target) { if (target !== activeTab) openFile(target); setTimeout(() => run(target), 30); } }} disabled={!target} block shortcut="Mod+Enter">Run</Button>
          )}
          <Button variant="ghost" icon={<Terminal />} onClick={() => togglePanel('terminal')} tooltip="Open terminal" />
        </div>
      </div>

      <div className="sidebar__section">
        <SectionHeader title="Recent runs" />
        {recent.length ? (
          <div className="sidebar__list">
            {recent.map((s) => (
              <div key={s.id} className="scm__file" onClick={() => { openFile(s.file); togglePanel('terminal'); }} title={s.command}>
                <Dot tone={s.status === 'done' ? 'success' : s.status === 'running' ? 'accent' : s.status === 'stopped' ? undefined : 'danger'} pulse={s.status === 'running'} />
                <FileIcon name={s.file} size="sm" />
                <span className="u-truncate">{baseName(s.file)}</span>
                <span className="path" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock style={{ width: 10, height: 10 }} />
                  {s.endedAt ? `${s.endedAt - s.startedAt}ms` : '…'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact icon={<Play />} title="Nothing run yet" description={runnable.length ? 'Press Ctrl+Enter to run the active file.' : capabilities?.runner === 'none' ? 'No code runner is configured on the server yet.' : 'Create a runnable file (e.g. .py, .js, .cpp, .java) to run it here.'} />
        )}
      </div>

      <div className="sidebar__section">
        <SectionHeader title="Diagnostics" badge={problems.length ? <span className="cv-badge cv-badge--danger cv-badge--count">{problems.length}</span> : null} />
        <div className="sidebar__hint" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button type="button" className="scm__file" style={{ padding: 0, height: 22 }} onClick={() => togglePanel('problems')}><AlertTriangle style={{ width: 13, height: 13, color: 'var(--warn)' }} /> Problems <ChevronRight style={{ width: 12, height: 12, marginLeft: 'auto' }} /></button>
          <button type="button" className="scm__file" style={{ padding: 0, height: 22 }} onClick={() => togglePanel('debug')}><Bug style={{ width: 13, height: 13, color: 'var(--info)' }} /> Debug console <ChevronRight style={{ width: 12, height: 12, marginLeft: 'auto' }} /></button>
        </div>
      </div>

      <div className="sidebar__section">
        <SectionHeader title={`Supported languages${capabilities?.runner && capabilities.runner !== 'unknown' ? ` · ${capabilities.runner}` : ''}`} />
        <div className="sidebar__hint" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Array.from(RUNNABLE).map((ext) => (
            <span key={ext} className="cv-chip"><FileIcon name={`x.${ext}`} size="sm" />{languageLabel(`x.${ext}`)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

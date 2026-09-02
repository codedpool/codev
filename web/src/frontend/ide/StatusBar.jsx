'use client';
import React from 'react';
import { GitBranch, AlertCircle, AlertTriangle, Sparkles, Bell, Cloud, CloudOff, Loader2, Play, Users, Wifi } from 'lucide-react';
import { Dot, Tooltip } from '../ui';
import { useWorkspace } from './WorkspaceContext';
import { usePresence } from './PresenceContext';
import { languageLabel } from '../lib/fileTypes';
import { SHORTCUTS } from './commands.jsx';

export default function StatusBar() {
  const ws = useWorkspace();
  const presence = usePresence();
  const { activeTab, cursorStore, problems, settings, setSettings, togglePanel, isRunning, sessions, openPalette, toggleSidebar, layout, dirty, saving, logs, git } = ws;
  const cursor = cursorStore.use();
  const errors = problems.filter((p) => p.severity === 'error').length;
  const warnings = problems.filter((p) => p.severity === 'warning').length;
  const lastRun = sessions[sessions.length - 1];
  const errorLogs = logs.filter((l) => l.level === 'error').length;

  const sync = presence.enabled ? presence.status : 'local';
  const syncLabel = {
    connected: 'Live',
    connecting: 'Connecting',
    initial: 'Connecting',
    reconnecting: 'Reconnecting',
    disconnected: 'Offline',
    local: 'Local',
  }[sync] || sync;
  const SyncIcon = sync === 'connected' ? Wifi : sync === 'disconnected' ? CloudOff : sync === 'local' ? Cloud : Loader2;

  return (
    <footer className="status" role="contentinfo">
      <div className="status__group">
        <Tooltip content={`Branch: ${git.branch} (local history, no remote)${git.headOid ? ` · HEAD ${git.headOid.slice(0, 7)}` : ' · no commits yet'}`}>
          <button type="button" className="status__item" onClick={() => toggleSidebar('scm')}><GitBranch />{git.branch}{dirty.size ? <span style={{ color: 'var(--modified)' }}>●</span> : null}</button>
        </Tooltip>
        <Tooltip content={presence.enabled ? `Collaboration ${syncLabel.toLowerCase()} · ${presence.others.length + 1} in workspace` : 'Collaboration is not configured (VITE_LIVEBLOCKS_PUBLIC_KEY)'}>
          <button type="button" className={`status__item ${sync === 'disconnected' ? 'status__item--danger' : ''}`} onClick={() => toggleSidebar('collab')}>
            <SyncIcon style={sync === 'connecting' || sync === 'initial' || sync === 'reconnecting' ? { animation: 'cv-spin 0.9s linear infinite' } : undefined} />
            {syncLabel}
            {presence.enabled && presence.others.length ? <><Users />{presence.others.length + 1}</> : null}
          </button>
        </Tooltip>
        <Tooltip content="Problems" shortcut={SHORTCUTS.problems}>
          <button type="button" className={`status__item ${errors ? 'status__item--danger' : warnings ? 'status__item--warn' : ''}`} onClick={() => togglePanel('problems')}>
            <AlertCircle />{errors}
            <AlertTriangle />{warnings}
          </button>
        </Tooltip>
        {isRunning ? (
          <span className="status__item status__item--running"><Loader2 style={{ animation: 'cv-spin 0.9s linear infinite' }} />Running…</span>
        ) : lastRun ? (
          <Tooltip content={`Last run: ${lastRun.status}${lastRun.endedAt ? ` · ${lastRun.endedAt - lastRun.startedAt}ms` : ''}`}>
            <button type="button" className="status__item is-muted" onClick={() => togglePanel('terminal')}><Play />{lastRun.endedAt ? `${lastRun.endedAt - lastRun.startedAt}ms` : ''}</button>
          </Tooltip>
        ) : null}
        {saving.size ? <span className="status__item is-muted"><Loader2 style={{ animation: 'cv-spin 0.9s linear infinite' }} />Saving</span> : null}
      </div>
      <div className="status__group status__group--right">
        {activeTab ? (
          <>
            <Tooltip content="Go to line" shortcut={SHORTCUTS.goToLine}>
              <button type="button" className="status__item" onClick={() => openPalette('line')}>
                Ln {cursor.line}, Col {cursor.col}
                {cursor.selChars ? <span className="u-muted">({cursor.selChars} selected{cursor.selLines > 1 ? ` · ${cursor.selLines} lines` : ''})</span> : null}
              </button>
            </Tooltip>
            <Tooltip content="Indentation">
              <button type="button" className="status__item status__item--optional" onClick={() => ws.openDialog('settings', { tab: 'editor' })}>Spaces: {settings.tabSize}</button>
            </Tooltip>
            <span className="status__item status__item--optional">UTF-8</span>
            <Tooltip content="Language mode">
              <button type="button" className="status__item" onClick={() => openPalette('files')}>{languageLabel(activeTab)}</button>
            </Tooltip>
          </>
        ) : null}
        <Tooltip content={settings.inlineAi ? 'Inline AI suggestions: on' : 'Inline AI suggestions: off'}>
          <button type="button" className={`status__item ${settings.inlineAi ? 'status__item--ai' : 'is-muted'}`} onClick={() => setSettings({ inlineAi: !settings.inlineAi })} aria-pressed={settings.inlineAi}>
            <Sparkles />AI {settings.inlineAi ? 'on' : 'off'}
          </button>
        </Tooltip>
        <Tooltip content="Debug console">
          <button type="button" className={`status__item ${errorLogs ? 'status__item--warn' : ''}`} onClick={() => togglePanel('debug')} aria-label="Notifications">
            <Bell />
            {errorLogs ? errorLogs : null}
          </button>
        </Tooltip>
        {layout.aiOpen ? null : (
          <Tooltip content="Open AI assistant" shortcut={SHORTCUTS.ai}>
            <button type="button" className="status__item status__item--ai" onClick={ws.toggleAi}><Dot tone="accent" style={{ background: 'var(--ai)' }} />Assistant</button>
          </Tooltip>
        )}
      </div>
    </footer>
  );
}

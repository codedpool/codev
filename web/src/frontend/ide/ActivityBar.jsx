'use client';
import React from 'react';
import { Files, Search, GitBranch, Play, Blocks, Sparkles, Users, Settings, UserCircle2 } from 'lucide-react';
import { Tooltip } from '../ui';
import { useWorkspace } from './WorkspaceContext';
import { usePresence } from './PresenceContext';
import { SHORTCUTS } from './commands.jsx';

export const VIEWS = [
  { id: 'explorer', label: 'Explorer', icon: Files, shortcut: SHORTCUTS.explorer },
  { id: 'search', label: 'Search', icon: Search, shortcut: SHORTCUTS.search },
  { id: 'scm', label: 'Source Control', icon: GitBranch, shortcut: SHORTCUTS.scm },
  { id: 'run', label: 'Run & Debug', icon: Play },
  { id: 'extensions', label: 'Extensions', icon: Blocks },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles, shortcut: SHORTCUTS.ai, ai: true },
  { id: 'collab', label: 'Collaboration', icon: Users, shortcut: SHORTCUTS.collab },
];

export default function ActivityBar() {
  const { layout, toggleSidebar, toggleAi, dirty, openDialog, currentUser } = useWorkspace();
  const presence = usePresence();

  return (
    <nav className="activity" aria-label="Primary">
      {VIEWS.map((v) => {
        const Icon = v.icon;
        const isAi = v.id === 'ai';
        const active = isAi ? layout.aiOpen : layout.sidebarOpen && layout.sidebarView === v.id;
        const badge = v.id === 'scm' && dirty.size ? dirty.size : v.id === 'collab' && presence.others.length ? presence.others.length : null;
        return (
          <Tooltip key={v.id} content={v.label} shortcut={v.shortcut} side="right">
            <button
              type="button"
              className={`activity__btn ${isAi ? 'activity__btn--ai' : ''} ${active ? 'is-active' : ''}`}
              aria-label={v.label}
              aria-pressed={active}
              onClick={() => (isAi ? toggleAi() : toggleSidebar(v.id))}
            >
              <Icon />
              {badge ? <span className={`activity__badge ${v.id === 'collab' ? '' : ''}`}>{badge}</span> : null}
              {v.id === 'collab' && !badge && presence.status === 'connected' ? <span className="activity__badge activity__badge--dot" /> : null}
            </button>
          </Tooltip>
        );
      })}
      <div className="activity__spacer" />
      <Tooltip content={currentUser.name} side="right">
        <button type="button" className="activity__btn" aria-label="Account" onClick={() => openDialog('settings', { tab: 'account' })}>
          <UserCircle2 />
        </button>
      </Tooltip>
      <Tooltip content="Settings" shortcut={SHORTCUTS.settings} side="right">
        <button type="button" className="activity__btn" aria-label="Settings" onClick={() => openDialog('settings')}>
          <Settings />
        </button>
      </Tooltip>
    </nav>
  );
}

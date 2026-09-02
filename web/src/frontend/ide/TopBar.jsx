'use client';
import React, { useRef, useState } from 'react';
import { useNavigate } from '../lib/nav';
import { useSession } from '../lib/session';
import { ChevronDown, GitBranch, Play, Square, Share2, Sparkles, Settings, Search, PanelLeft, PanelBottom, Menu as MenuIcon, LogOut, LayoutGrid, Keyboard, Command, Loader2, Check, Cloud, CloudOff, Wifi } from 'lucide-react';
import { Button, IconButton, Kbd, Menu, useMenu, Popover, Avatar, AvatarStack, Dot, Logo, Tooltip } from '../ui';
import { useWorkspace } from './WorkspaceContext';
import { usePresence } from './PresenceContext';
import { SHORTCUTS } from './commands.jsx';
import { isRunnable, baseName } from '../lib/fileTypes';

function BranchPopover({ anchor, open, onClose }) {
  const { files, dirty, untracked, git, openDialog } = useWorkspace();
  return (
    <Popover open={open} anchor={anchor} onClose={onClose} width={280}>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitBranch style={{ width: 14, height: 14, color: 'var(--text-3)' }} />
          <strong style={{ fontSize: 'var(--fs-md)' }}>{git.branch}</strong>
          <span className="cv-badge">local</span>
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', lineHeight: 1.5 }}>
          Commits are real local version history (no remote) — commit from Source Control, browse and revert from History.
        </div>
        <dl className="kv" style={{ padding: 0 }}>
          <dt>Tracked files</dt><dd>{files.length}</dd>
          <dt>Modified</dt><dd>{dirty.size}</dd>
          <dt>New this session</dt><dd>{untracked.size}</dd>
          <dt>HEAD</dt><dd>{git.headOid ? <code>{git.headOid.slice(0, 7)}</code> : '—'}</dd>
        </dl>
        <Button size="sm" variant="ghost" icon={<GitBranch />} onClick={() => { onClose(); openDialog('history'); }}>View history</Button>
      </div>
    </Popover>
  );
}

export default function TopBar({ compact, mobile }) {
  const ws = useWorkspace();
  const presence = usePresence();
  const navigate = useNavigate();
  const { signOut, signIn, isAuthenticated } = useSession();
  const { project, activeTab, isRunning, run, stop, layout, toggleSidebar, togglePanel, toggleAi, openPalette, openDialog, dirty, saving, currentUser, syncStatus, git } = ws;
  const [branchOpen, setBranchOpen] = useState(false);
  const branchRef = useRef(null);
  const userMenu = useMenu();
  const projMenu = useMenu();
  const presMenu = useMenu();

  const canRun = !!activeTab && isRunnable(activeTab);
  const others = presence.others;
  const users = [...(presence.self ? [{ ...presence.self, id: 'self', title: `${presence.self.name} (you)` }] : []), ...others.map((o) => ({ ...o, title: `${o.name}${o.file ? ` · ${baseName(o.file)}` : ''}` }))];

  const live = presence.enabled ? presence.status : 'local';
  const liveLabel = live === 'connected' ? `Live · ${others.length + 1} online` : live === 'local' ? 'Local' : live === 'reconnecting' ? 'Reconnecting…' : live === 'disconnected' ? 'Offline' : 'Connecting…';
  const liveTone = live === 'connected' ? 'success' : live === 'local' ? undefined : live === 'disconnected' ? 'danger' : 'warn';

  return (
    <header className="topbar" role="banner">
      <div className="topbar__group">
        {mobile ? (
          <IconButton label="Menu" onClick={() => toggleSidebar()} className="topbar__mobile-only"><MenuIcon /></IconButton>
        ) : null}
        <button type="button" className="topbar__project" style={{ paddingLeft: 4 }} onClick={() => navigate('/dashboard')} aria-label="Go to projects">
          <Logo word={!compact} />
        </button>
        <span className="topbar__sep topbar__hide-mobile" />
        <button type="button" className="topbar__project topbar__hide-mobile" onClick={(e) => projMenu.openAt(e.currentTarget)} aria-haspopup="menu" aria-expanded={projMenu.open}>
          <LayoutGrid />
          <span className="u-truncate">{project?.projectName || 'Loading…'}</span>
          <ChevronDown />
        </button>
        <Menu
          open={projMenu.open}
          anchor={projMenu.anchor}
          onClose={projMenu.close}
          items={[
            { title: project?.projectName || 'Project' },
            { label: 'All projects', icon: <LayoutGrid />, onSelect: () => navigate('/dashboard') },
            { label: 'Share workspace…', icon: <Share2 />, onSelect: () => openDialog('share') },
            { separator: true },
            { label: 'Project settings…', icon: <Settings />, onSelect: () => openDialog('settings') },
            { label: 'Copy project ID', hint: ws.projectId.slice(0, 8), onSelect: () => navigator.clipboard.writeText(ws.projectId) },
          ]}
        />
        <button ref={branchRef} type="button" className="topbar__branch topbar__hide-compact" onClick={() => setBranchOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={branchOpen}>
          <GitBranch />
          <span>{git.branch}</span>
          {dirty.size ? <span className="cv-badge cv-badge--warn cv-badge--count" title={`${dirty.size} unsaved`}>{dirty.size}</span> : null}
        </button>
        <BranchPopover anchor={branchRef.current} open={branchOpen} onClose={() => setBranchOpen(false)} />
      </div>

      <div className="topbar__group topbar__group--center topbar__hide-mobile">
        <button type="button" className="topbar__search" onClick={() => openPalette('files')} aria-label="Search files and commands">
          <Search />
          <span>Search files, commands…</span>
          <Kbd combo={SHORTCUTS.quickOpen} />
        </button>
      </div>

      <div className="topbar__group topbar__group--right">
        {saving.size ? (
          <Tooltip content="Saving…"><span className="topbar__live"><Loader2 className="cv-spin" style={{ width: 12, height: 12, animation: 'cv-spin 0.8s linear infinite' }} /></span></Tooltip>
        ) : null}
        {isRunning ? (
          <Button variant="stop" size="sm" icon={<Square />} onClick={stop} className="topbar__run" tooltip="Stop">Stop</Button>
        ) : (
          <Button variant="primary" size="sm" icon={<Play />} onClick={() => run()} disabled={!canRun} className="topbar__run" tooltip={canRun ? 'Run current file' : activeTab ? 'This file type cannot be run' : 'Open a runnable file'} tooltipShortcut={SHORTCUTS.run}>Run</Button>
        )}
        <span className="topbar__sep" />
        <button type="button" className="topbar__presence topbar__hide-mobile" onClick={(e) => presMenu.openAt(e.currentTarget)} aria-label="Collaborators" aria-haspopup="menu">
          <AvatarStack users={users} max={4} size="sm" />
          <span className="topbar__live"><Dot tone={liveTone} pulse={live === 'connecting' || live === 'reconnecting'} />{liveLabel}</span>
        </button>
        <Menu
          open={presMenu.open}
          anchor={presMenu.anchor}
          onClose={presMenu.close}
          align="end"
          minWidth={240}
          items={[
            { title: liveLabel },
            ...(users.length ? users.map((u) => ({ label: `${u.name}${u.id === 'self' ? ' (you)' : ''}`, hint: u.file ? baseName(u.file) : '', icon: <Avatar name={u.name} src={u.avatar} color={u.color} size="sm" />, onSelect: () => (u.file && u.id !== 'self' ? ws.openFile(u.file) : null) })) : [{ label: 'No one else is here yet', disabled: true }]),
            { separator: true },
            { label: 'Invite collaborators…', icon: <Share2 />, onSelect: () => openDialog('share') },
            { label: 'Open collaboration view', icon: <Wifi />, onSelect: () => toggleSidebar('collab') },
          ]}
        />
        <Button variant="ghost" size="sm" icon={<Share2 />} onClick={() => openDialog('share')} className="topbar__hide-compact">Share</Button>
        <span className="topbar__sep topbar__hide-mobile" />
        <IconButton label="Toggle sidebar" shortcut={SHORTCUTS.sidebar} active={layout.sidebarOpen} onClick={() => toggleSidebar()} className="topbar__hide-mobile"><PanelLeft /></IconButton>
        <IconButton label="Toggle panel" shortcut={SHORTCUTS.panel} active={layout.panelOpen} onClick={() => togglePanel()} className="topbar__hide-mobile"><PanelBottom /></IconButton>
        <IconButton label="AI assistant" shortcut={SHORTCUTS.ai} active={layout.aiOpen} tone="ai" onClick={toggleAi}><Sparkles /></IconButton>
        <IconButton label="Settings" shortcut={SHORTCUTS.settings} onClick={() => openDialog('settings')} className="topbar__hide-mobile"><Settings /></IconButton>
        <button type="button" className="topbar__avatar" onClick={(e) => userMenu.openAt(e.currentTarget)} aria-label="Account menu" aria-haspopup="menu">
          <Avatar name={currentUser.name} src={currentUser.avatar} size="md" />
        </button>
        <Menu
          open={userMenu.open}
          anchor={userMenu.anchor}
          onClose={userMenu.close}
          align="end"
          minWidth={220}
          items={[
            { title: isAuthenticated ? currentUser.email || currentUser.name : 'Not signed in' },
            { label: 'Command palette', icon: <Command />, shortcut: SHORTCUTS.palette, onSelect: () => openPalette('commands') },
            { label: 'Keyboard shortcuts', icon: <Keyboard />, shortcut: SHORTCUTS.shortcuts, onSelect: () => openDialog('shortcuts') },
            { label: 'Settings', icon: <Settings />, shortcut: SHORTCUTS.settings, onSelect: () => openDialog('settings') },
            { separator: true },
            { label: syncStatus === 'synced' ? 'Collaboration connected' : syncStatus === 'local' ? 'Collaboration not configured' : syncStatus === 'offline' ? 'Collaboration offline' : 'Connecting collaboration…', icon: syncStatus === 'synced' ? <Check /> : syncStatus === 'offline' ? <CloudOff /> : <Cloud />, disabled: true },
            { separator: true },
            isAuthenticated
              ? { label: 'Log out', icon: <LogOut />, onSelect: () => signOut() }
              : { label: 'Log in', icon: <LogOut />, onSelect: () => signIn() },
          ]}
        />
      </div>
    </header>
  );
}

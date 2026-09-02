'use client';
// IDE page: /ide/[projectId]/[[...path]]  (the catch-all is the open file path; old /ide/:projectId/:fileName links still work)
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '../lib/nav';
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext';
import { PresenceProvider, usePresence } from './PresenceContext';
import { AiProvider, useAi } from './ai/AiContext';
import TopBar from './TopBar';
import ActivityBar from './ActivityBar';
import SidePanel from './sidebar/SidePanel';
import EditorGroup from './EditorGroup';
import BottomPanel from './panel/BottomPanel';
import AiPanel from './ai/AiPanel';
import StatusBar from './StatusBar';
import CommandPalette from './CommandPalette';
import Dialogs from './dialogs/Dialogs';
import { buildCommands, SHORTCUTS } from './commands.jsx';
import { useHotkeys } from '../hooks/useHotkeys';
import { useResizable } from '../hooks/useResizable';
import { useIsCompact, useIsMobile } from '../hooks/useMediaQuery';
import { baseName } from '../lib/fileTypes';

function Resizer({ className, ...props }) {
  const [active, setActive] = useState(false);
  return (
    <div
      className={`resizer ${className} ${active ? 'is-active' : ''}`}
      {...props}
      onPointerDown={(e) => { setActive(true); props.onPointerDown?.(e); }}
      onPointerUp={(e) => { setActive(false); props.onPointerUp?.(e); }}
      onPointerCancel={(e) => { setActive(false); props.onPointerCancel?.(e); }}
      aria-label="Resize"
    />
  );
}

function IdeShell({ fileParam }) {
  const ws = useWorkspace();
  const ai = useAi();
  const presence = usePresence();
  const navigate = useNavigate();
  const compact = useIsCompact();
  const mobile = useIsMobile();
  const { layout, setLayout, activeTab, openFile, project, tabs, closeTab } = ws;

  // Sync URL → open file (back/forward, shared links)
  useEffect(() => {
    if (fileParam && fileParam !== activeTab) openFile(fileParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileParam]);

  useEffect(() => {
    document.title = `${activeTab ? `${baseName(activeTab)}${ws.dirty.has(activeTab) ? ' •' : ''} — ` : ''}${project?.projectName || 'Codev'} · Codev`;
  }, [activeTab, project, ws.dirty]);

  // Keep toasts clear of the AI panel
  useEffect(() => {
    document.documentElement.style.setProperty('--toast-right', layout.aiOpen && !compact ? `${layout.aiWidth + 14}px` : '12px');
    return () => document.documentElement.style.removeProperty('--toast-right');
  }, [layout.aiOpen, layout.aiWidth, compact]);

  // On small screens the side panels overlay the editor: start closed
  useEffect(() => {
    if (compact) setLayout({ sidebarOpen: false, aiOpen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  const commands = useMemo(() => buildCommands({ ws, ai, presence, navigate }), [ws, ai, presence, navigate]);

  useHotkeys(
    [
      { combo: SHORTCUTS.palette, handler: () => ws.openPalette('commands') },
      { combo: SHORTCUTS.paletteAlt, handler: () => ws.openPalette('commands') },
      { combo: SHORTCUTS.quickOpen, handler: () => ws.openPalette('files') },
      { combo: SHORTCUTS.run, handler: () => (ws.isRunning ? null : ws.run()) },
      { combo: SHORTCUTS.save, handler: () => ws.saveActive() },
      { combo: SHORTCUTS.saveAll, handler: () => ws.saveAll() },
      { combo: SHORTCUTS.sidebar, handler: () => ws.toggleSidebar() },
      { combo: SHORTCUTS.panel, handler: () => ws.togglePanel() },
      { combo: SHORTCUTS.terminal, handler: () => ws.togglePanel('terminal') },
      { combo: SHORTCUTS.problems, handler: () => ws.togglePanel('problems') },
      { combo: SHORTCUTS.ai, handler: () => ws.toggleAi() },
      { combo: SHORTCUTS.inlineAi, handler: () => window.dispatchEvent(new CustomEvent('cv:inline-ai')), when: () => !!ws.activeTab },
      { combo: SHORTCUTS.explorer, handler: () => ws.toggleSidebar('explorer') },
      { combo: SHORTCUTS.search, handler: () => ws.toggleSidebar('search') },
      { combo: SHORTCUTS.scm, handler: () => ws.toggleSidebar('scm') },
      { combo: SHORTCUTS.collab, handler: () => ws.toggleSidebar('collab') },
      { combo: SHORTCUTS.newFile, handler: () => ws.openDialog('newFile') },
      { combo: SHORTCUTS.settings, handler: () => ws.openDialog('settings') },
      { combo: SHORTCUTS.shortcuts, handler: () => ws.openDialog('shortcuts') },
      { combo: SHORTCUTS.goToLine, handler: () => ws.openPalette('line'), when: () => !!ws.activeTab },
      // Ctrl+W is reserved by browsers in most cases; keep it best-effort.
      { combo: SHORTCUTS.closeTab, handler: () => activeTab && closeTab(activeTab), when: () => !!activeTab && tabs.length > 0 },
    ],
    [ws, activeTab, tabs]
  );

  // Panel sizes
  const sidebarResize = useResizable({ size: layout.sidebarWidth, min: 180, max: 520, onChange: (w) => setLayout({ sidebarWidth: w }) });
  const aiResize = useResizable({ size: layout.aiWidth, min: 280, max: 640, sign: -1, onChange: (w) => setLayout({ aiWidth: w }) });
  const panelResize = useResizable({ size: layout.panelHeight, min: 90, max: Math.max(200, window.innerHeight - 260), axis: 'y', sign: -1, onChange: (h) => setLayout({ panelHeight: h }) });

  const showScrim = compact && (layout.sidebarOpen || layout.aiOpen);

  return (
    <div className={`ide ${compact ? 'is-compact' : ''} ${mobile ? 'is-mobile' : ''}`}>
      <TopBar compact={compact} mobile={mobile} />
      <div className="ide__body">
        <ActivityBar />
        {layout.sidebarOpen ? (
          <>
            <SidePanel width={mobile ? 300 : layout.sidebarWidth} />
            <Resizer className="resizer--x resizer--sidebar" {...sidebarResize} />
          </>
        ) : null}
        <main className="ide__main" aria-label="Editor">
          <EditorGroup />
          {layout.panelOpen ? (
            <>
              {!layout.panelMaximized ? <Resizer className="resizer--y" {...panelResize} /> : null}
              <BottomPanel height={layout.panelHeight} />
            </>
          ) : null}
        </main>
        {layout.aiOpen ? (
          <>
            <Resizer className="resizer--x resizer--ai" {...aiResize} />
            <AiPanel width={layout.aiWidth} />
          </>
        ) : null}
        {showScrim ? <div className="ide__scrim" onClick={() => setLayout({ sidebarOpen: false, aiOpen: false })} aria-hidden /> : null}
      </div>
      <StatusBar />
      <CommandPalette commands={commands} />
      <Dialogs />
    </div>
  );
}

/** @param {{ projectId: string, path?: string[] }} props — from the Next.js route params */
export default function IDE({ projectId, path }) {
  const fileParam = useMemo(() => {
    if (!path || !path.length) return null;
    try { return path.map(decodeURIComponent).join('/'); } catch { return path.join('/'); }
  }, [path]);

  return (
    <WorkspaceProvider key={projectId} projectId={projectId} initialFile={fileParam}>
      <PresenceProvider>
        <AiProvider><IdeShell fileParam={fileParam} /></AiProvider>
      </PresenceProvider>
    </WorkspaceProvider>
  );
}

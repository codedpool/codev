'use client';
// Command registry: one source of truth for the palette, menus, tooltips and keyboard shortcuts.
import React from 'react';
import {
  Play, Square, Save, SaveAll, Search, FileText, FolderPlus, FilePlus, PanelLeft, PanelBottom, Sparkles, Settings, Share2, Terminal,
  AlertTriangle, Bug, Command, GitBranch, Users, Keyboard, WrapText, Map, LayoutGrid, Trash2, X, Braces, MessageSquareText, Wand2, TestTube2, BookOpen, Upload,
  Home, RefreshCw, Maximize2, ChevronsLeftRight,
} from 'lucide-react';

export const SHORTCUTS = {
  palette: 'Mod+K',
  paletteAlt: 'Mod+Shift+P',
  quickOpen: 'Mod+P',
  run: 'Mod+Enter',
  save: 'Mod+S',
  saveAll: 'Mod+Alt+S',
  sidebar: 'Mod+B',
  panel: 'Mod+J',
  ai: 'Mod+Shift+L',
  inlineAi: 'Mod+I',
  explorer: 'Mod+Shift+E',
  search: 'Mod+Shift+F',
  scm: 'Mod+Shift+G',
  collab: 'Mod+Shift+U',
  newFile: 'Mod+Alt+N',
  closeTab: 'Mod+W',
  settings: 'Mod+Comma',
  terminal: 'Mod+Backquote',
  problems: 'Mod+Shift+M',
  find: 'Mod+F',
  goToLine: 'Mod+G',
  shortcuts: 'Mod+Shift+/',
};

/**
 * Build the command list from workspace/AI contexts. Each: { id, label, group, icon, shortcut, run, when? , keywords? }
 */
export function buildCommands({ ws, ai, presence, navigate }) {
  const { layout } = ws;
  const hasFile = !!ws.activeTab;
  const cmds = [
    // Files
    { id: 'file.new', label: 'New File', group: 'File', icon: <FilePlus />, shortcut: SHORTCUTS.newFile, run: () => ws.openDialog('newFile') },
    { id: 'file.newFolder', label: 'New Folder', group: 'File', icon: <FolderPlus />, run: () => ws.openDialog('newFolder') },
    { id: 'file.upload', label: 'Upload Files', group: 'File', icon: <Upload />, run: () => document.getElementById('cv-upload-input')?.click() },
    { id: 'file.save', label: 'Save', group: 'File', icon: <Save />, shortcut: SHORTCUTS.save, run: () => ws.saveActive(), when: hasFile },
    { id: 'file.saveAll', label: 'Save All', group: 'File', icon: <SaveAll />, shortcut: SHORTCUTS.saveAll, run: () => ws.saveAll(), when: ws.dirty.size > 0 },
    { id: 'file.rename', label: 'Rename File', group: 'File', icon: <FileText />, run: () => ws.openDialog('rename', { path: ws.activeTab }), when: hasFile },
    { id: 'file.delete', label: 'Delete File', group: 'File', icon: <Trash2 />, run: () => ws.openDialog('confirmDelete', { path: ws.activeTab }), when: hasFile, danger: true },
    { id: 'file.close', label: 'Close Editor', group: 'File', icon: <X />, shortcut: SHORTCUTS.closeTab, run: () => ws.closeTab(ws.activeTab), when: hasFile },
    { id: 'file.closeAll', label: 'Close All Editors', group: 'File', icon: <X />, run: () => ws.closeTabs(ws.tabs), when: ws.tabs.length > 0 },
    { id: 'file.quickOpen', label: 'Go to File', group: 'Navigate', icon: <Search />, shortcut: SHORTCUTS.quickOpen, run: () => ws.openPalette('files') },
    { id: 'nav.goToLine', label: 'Go to Line', group: 'Navigate', icon: <ChevronsLeftRight />, shortcut: SHORTCUTS.goToLine, run: () => ws.openPalette('line'), when: hasFile },
    { id: 'nav.symbol', label: 'Go to Symbol in File', group: 'Navigate', icon: <Braces />, run: () => ws.openPalette('symbols'), when: hasFile },
    { id: 'nav.find', label: 'Find in File', group: 'Navigate', icon: <Search />, shortcut: SHORTCUTS.find, run: () => ws.editorRef.current?.openSearch?.(), when: hasFile },
    { id: 'nav.searchProject', label: 'Search in Project', group: 'Navigate', icon: <Search />, shortcut: SHORTCUTS.search, run: () => ws.toggleSidebar('search') },
    { id: 'nav.dashboard', label: 'Open Projects Dashboard', group: 'Navigate', icon: <Home />, run: () => navigate('/dashboard') },
    // Run
    { id: 'run.run', label: ws.isRunning ? 'Run (already running)' : 'Run Code', group: 'Run', icon: <Play />, shortcut: SHORTCUTS.run, run: () => ws.run(), when: hasFile && !ws.isRunning },
    { id: 'run.stop', label: 'Stop Run', group: 'Run', icon: <Square />, run: () => ws.stop(), when: ws.isRunning },
    { id: 'run.clearTerminal', label: 'Clear Terminal', group: 'Run', icon: <Terminal />, run: () => ws.clearSessions() },
    // View
    { id: 'view.sidebar', label: `${layout.sidebarOpen ? 'Hide' : 'Show'} Sidebar`, keywords: 'toggle explorer', group: 'View', icon: <PanelLeft />, shortcut: SHORTCUTS.sidebar, run: () => ws.toggleSidebar() },
    { id: 'view.panel', label: `${layout.panelOpen ? 'Hide' : 'Show'} Bottom Panel`, keywords: 'toggle terminal', group: 'View', icon: <PanelBottom />, shortcut: SHORTCUTS.panel, run: () => ws.togglePanel() },
    { id: 'view.terminal', label: 'Open Terminal', keywords: 'toggle', group: 'View', icon: <Terminal />, shortcut: SHORTCUTS.terminal, run: () => ws.togglePanel('terminal') },
    { id: 'view.problems', label: 'Show Problems', group: 'View', icon: <AlertTriangle />, shortcut: SHORTCUTS.problems, run: () => ws.togglePanel('problems') },
    { id: 'view.output', label: 'Show Output', group: 'View', icon: <LayoutGrid />, run: () => ws.togglePanel('output') },
    { id: 'view.debug', label: 'Show Debug Console', group: 'View', icon: <Bug />, run: () => ws.togglePanel('debug') },
    { id: 'view.maximizePanel', label: `${layout.panelMaximized ? 'Restore' : 'Maximize'} Panel`, group: 'View', icon: <Maximize2 />, run: () => ws.setLayout({ panelOpen: true, panelMaximized: !layout.panelMaximized }) },
    { id: 'view.explorer', label: 'Show Explorer', group: 'View', icon: <FileText />, shortcut: SHORTCUTS.explorer, run: () => ws.toggleSidebar('explorer') },
    { id: 'view.scm', label: 'Show Source Control', group: 'View', icon: <GitBranch />, shortcut: SHORTCUTS.scm, run: () => ws.toggleSidebar('scm') },
    { id: 'view.collab', label: 'Show Collaboration', group: 'View', icon: <Users />, shortcut: SHORTCUTS.collab, run: () => ws.toggleSidebar('collab') },
    { id: 'view.wrap', label: `${ws.settings.wordWrap ? 'Disable' : 'Enable'} Word Wrap`, keywords: 'toggle', group: 'View', icon: <WrapText />, run: () => ws.setSettings({ wordWrap: !ws.settings.wordWrap }) },
    { id: 'view.minimap', label: `${ws.settings.minimap ? 'Hide' : 'Show'} Minimap`, keywords: 'toggle', group: 'View', icon: <Map />, run: () => ws.setSettings({ minimap: !ws.settings.minimap }) },
    { id: 'view.reload', label: 'Reload Project Files', group: 'View', icon: <RefreshCw />, run: () => ws.reloadProject() },
    // AI
    { id: 'ai.toggle', label: `${layout.aiOpen ? 'Hide' : 'Show'} AI Assistant`, keywords: 'toggle chat', group: 'AI', icon: <Sparkles />, shortcut: SHORTCUTS.ai, run: () => ws.toggleAi() },
    { id: 'ai.inline', label: 'Ask AI to Edit Selection (Inline)', group: 'AI', icon: <Wand2 />, shortcut: SHORTCUTS.inlineAi, run: () => window.dispatchEvent(new CustomEvent('cv:inline-ai')), when: hasFile },
    { id: 'ai.explain', label: 'AI: Explain Code', group: 'AI', icon: <MessageSquareText />, run: () => ai.runAction('explain'), when: hasFile },
    { id: 'ai.fix', label: 'AI: Fix Errors', group: 'AI', icon: <Wand2 />, run: () => ai.runAction('fix'), when: hasFile },
    { id: 'ai.refactor', label: 'AI: Refactor', group: 'AI', icon: <Braces />, run: () => ai.runAction('refactor'), when: hasFile },
    { id: 'ai.tests', label: 'AI: Generate Tests', group: 'AI', icon: <TestTube2 />, run: () => ai.runAction('tests'), when: hasFile },
    { id: 'ai.docs', label: 'AI: Generate Documentation', group: 'AI', icon: <BookOpen />, run: () => ai.runAction('docs'), when: hasFile },
    { id: 'ai.inlineToggle', label: `${ws.settings.inlineAi ? 'Disable' : 'Enable'} Inline AI Suggestions`, keywords: 'toggle ghost text completion', group: 'AI', icon: <Sparkles />, run: () => ws.setSettings({ inlineAi: !ws.settings.inlineAi }) },
    { id: 'ai.clear', label: 'AI: Clear Conversation', group: 'AI', icon: <Trash2 />, run: () => ai.clear(), when: ai.messages.length > 0 },
    // Collaboration
    { id: 'collab.share', label: 'Share Workspace / Invite Collaborator', group: 'Collaboration', icon: <Share2 />, run: () => ws.openDialog('share') },
    // Settings
    { id: 'settings.open', label: 'Open Settings', group: 'Preferences', icon: <Settings />, shortcut: SHORTCUTS.settings, run: () => ws.openDialog('settings') },
    { id: 'settings.shortcuts', label: 'Keyboard Shortcuts', group: 'Preferences', icon: <Keyboard />, shortcut: SHORTCUTS.shortcuts, run: () => ws.openDialog('shortcuts') },
    { id: 'settings.palette', label: 'Command Palette', group: 'Preferences', icon: <Command />, shortcut: SHORTCUTS.palette, run: () => ws.openPalette('commands') },
  ];
  void presence;
  return cmds.filter((c) => c.when === undefined || c.when);
}

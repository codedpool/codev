'use client';
import React from 'react';
import { X } from 'lucide-react';
import { IconButton } from '../../ui';
import { useWorkspace } from '../WorkspaceContext';
import ExplorerView from './ExplorerView';
import SearchView from './SearchView';
import SourceControlView from './SourceControlView';
import RunView from './RunView';
import ExtensionsView from './ExtensionsView';
import CollabView from './CollabView';
import { VIEWS } from '../ActivityBar';

const VIEW_COMPONENTS = {
  explorer: ExplorerView,
  search: SearchView,
  scm: SourceControlView,
  run: RunView,
  extensions: ExtensionsView,
  collab: CollabView,
};

export default function SidePanel({ width }) {
  const { layout, toggleSidebar } = useWorkspace();
  const view = VIEWS.find((v) => v.id === layout.sidebarView) || VIEWS[0];
  const Body = VIEW_COMPONENTS[view.id] || ExplorerView;
  return (
    <aside className="sidebar" style={{ '--sidebar-w': `${width}px` }} aria-label={view.label}>
      <div className="sidebar__head">
        <span className="sidebar__title">{view.label}</span>
        <IconButton size="sm" label="Close sidebar" onClick={() => toggleSidebar()}><X /></IconButton>
      </div>
      <Body key={view.id} />
    </aside>
  );
}

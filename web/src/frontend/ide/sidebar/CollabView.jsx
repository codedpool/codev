'use client';
import React from 'react';
import { Share2, Users, Copy, Link2, Wifi, WifiOff, ExternalLink } from 'lucide-react';
import { Button, Avatar, SectionHeader, Dot, EmptyState, useToast } from '../../ui';
import { useWorkspace } from '../WorkspaceContext';
import { usePresence } from '../PresenceContext';

export default function CollabView() {
  const ws = useWorkspace();
  const presence = usePresence();
  const { toast } = useToast();
  const { openFile, openDialog, activeTab } = ws;
  const link = `${window.location.origin}/ide/${encodeURIComponent(ws.projectId)}${activeTab ? '/' + activeTab.split('/').map(encodeURIComponent).join('/') : ''}`;
  const status = presence.enabled ? presence.status : 'local';
  const copy = () => { navigator.clipboard.writeText(link); toast({ kind: 'success', title: 'Invite link copied', duration: 1800 }); };

  return (
    <div className="sidebar__body">
      <div className="sidebar__stack">
        <div className="notice" style={{ alignItems: 'center' }}>
          <span className="notice__icon" style={{ color: status === 'connected' ? 'var(--success)' : status === 'local' ? 'var(--text-3)' : 'var(--warn)' }}>{status === 'connected' ? <Wifi /> : status === 'local' ? <WifiOff /> : <Wifi />}</span>
          <div style={{ flex: 1 }}>
            <div className="notice__title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Dot tone={status === 'connected' ? 'success' : status === 'local' ? undefined : 'warn'} pulse={status !== 'connected' && status !== 'local'} />
              {status === 'connected' ? 'Live collaboration on' : status === 'local' ? 'Local session' : status === 'disconnected' ? 'Disconnected' : 'Connecting…'}
            </div>
            <div className="notice__desc">{status === 'connected' ? 'Edits sync in real time. Cursors and selections of others appear in the editor.' : status === 'local' ? 'Set VITE_LIVEBLOCKS_PUBLIC_KEY to enable real-time collaboration.' : 'Trying to reach the collaboration service.'}</div>
          </div>
        </div>
        <Button variant="primary" icon={<Share2 />} onClick={() => openDialog('share')} block>Invite collaborators</Button>
        <Button variant="secondary" icon={<Copy />} onClick={copy} block>Copy invite link</Button>
      </div>

      <div className="sidebar__section sidebar__section--grow">
        <SectionHeader title="In this workspace" badge={<span className="cv-badge cv-badge--count">{presence.others.length + 1}</span>} />
        {presence.self ? (
          <div className="collab__user">
            <Avatar name={presence.self.name} src={presence.self.avatar} color={presence.self.color} size="md" status />
            <div className="collab__name">
              <span>{presence.self.name} <span className="u-muted">(you)</span></span>
              <small>{activeTab ? activeTab : 'No file open'}</small>
            </div>
          </div>
        ) : null}
        {presence.others.length ? presence.others.map((o) => (
          <div key={o.id} className="collab__user">
            <Avatar name={o.name} src={o.avatar} color={o.color} size="md" status />
            <div className="collab__name">
              <span>{o.name}</span>
              <small>{o.file ? `${o.file}${o.line ? `:${o.line}` : ''}` : 'Browsing'}</small>
            </div>
            {o.file ? <Button size="sm" variant="ghost" icon={<ExternalLink />} onClick={() => openFile(o.file)}>Follow</Button> : null}
          </div>
        )) : (
          <EmptyState compact icon={<Users />} title="You're the only one here" description="Share the link and collaborators will appear here with the file they're editing." />
        )}
      </div>

      <div className="sidebar__section">
        <SectionHeader title="How sharing works" />
        <div className="sidebar__hint">
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}><Link2 style={{ width: 13, height: 13, flex: 'none', marginTop: 2 }} /><span>Anyone with the workspace link can open it and edit files with you in real time.</span></div>
          <div style={{ display: 'flex', gap: 8 }}><Users style={{ width: 13, height: 13, flex: 'none', marginTop: 2 }} /><span>Each file is a shared document — edits merge automatically without conflicts.</span></div>
        </div>
      </div>
    </div>
  );
}

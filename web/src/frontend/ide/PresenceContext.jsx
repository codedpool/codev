'use client';
// Project-level presence (who is in the workspace, which file/line they're on) using Yjs awareness
// over the y-websocket collab server. Degrades to "local" when collaboration is not configured.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { collabEnabled, createProvider, projectRoom } from '../collab/client';
import { colorFor } from '../lib/colors';
import { useWorkspace } from './WorkspaceContext';

const PresenceCtx = createContext({ others: [], self: null, status: 'local', enabled: false });

export function PresenceProvider({ children }) {
  const { projectId, activeTab, currentUser, cursorStore } = useWorkspace();
  const [others, setOthers] = useState([]);
  const [status, setStatus] = useState(collabEnabled ? 'connecting' : 'local');
  const providerRef = useRef(null);
  const color = useMemo(() => colorFor(currentUser.id || currentUser.name), [currentUser]);

  // Connect once per project
  useEffect(() => {
    if (!collabEnabled) return;
    const doc = new Y.Doc();
    const provider = createProvider(projectRoom(projectId), doc);
    providerRef.current = provider;
    const aw = provider.awareness;
    const onChange = () => {
      const list = [];
      aw.getStates().forEach((state, clientId) => {
        if (clientId === aw.clientID || !state?.user) return;
        list.push({
          id: String(clientId),
          connectionId: clientId,
          name: state.user.name || 'Guest',
          avatar: state.user.avatar || null,
          color: state.user.color || colorFor(String(clientId)),
          file: state.file || null,
          line: state.line || null,
          userId: state.user.userId,
        });
      });
      list.sort((a, b) => a.connectionId - b.connectionId);
      setOthers(list);
    };
    const onStatus = ({ status: s }) => setStatus(s === 'connected' ? 'connected' : s === 'connecting' ? 'connecting' : 'disconnected');
    aw.on('change', onChange);
    provider.on('status', onStatus);
    return () => {
      aw.off('change', onChange);
      provider.off('status', onStatus);
      provider.destroy();
      doc.destroy();
      providerRef.current = null;
    };
  }, [projectId]);

  // Identity + active file
  useEffect(() => {
    const aw = providerRef.current?.awareness;
    if (!aw) return;
    aw.setLocalStateField('user', { name: currentUser.name, avatar: currentUser.avatar || null, color, userId: currentUser.id });
    aw.setLocalStateField('file', activeTab || null);
  }, [currentUser, color, activeTab, status]);

  // Cursor line, throttled
  const last = useRef(0);
  useEffect(() => {
    return cursorStore.subscribe(() => {
      const aw = providerRef.current?.awareness;
      if (!aw) return;
      const now = Date.now();
      if (now - last.current < 250) return;
      last.current = now;
      const c = cursorStore.get();
      aw.setLocalStateField('line', c.line);
      aw.setLocalStateField('col', c.col);
    });
  }, [cursorStore]);

  const value = useMemo(
    () => ({
      enabled: collabEnabled,
      status,
      others,
      self: { id: 'me', name: currentUser.name, avatar: currentUser.avatar, color, file: activeTab },
    }),
    [status, others, currentUser, color, activeTab]
  );
  return <PresenceCtx.Provider value={value}>{children}</PresenceCtx.Provider>;
}

export function usePresence() {
  return useContext(PresenceCtx);
}

'use client';
// Real-time collaboration transport: Yjs over y-websocket. Enabled when NEXT_PUBLIC_COLLAB_URL is set
// (run `npm run collab` for the bundled server). Without it the editor works in local mode.
import { WebsocketProvider } from 'y-websocket';

export const collabUrl = process.env.NEXT_PUBLIC_COLLAB_URL || '';
export const collabEnabled = !!collabUrl;

/** Room name for a file document — same scheme as before (`${projectId}-${fileName}`), URL-safe. */
export const fileRoom = (projectId, fileName) => encodeURIComponent(`${projectId}-${fileName}`);
export const projectRoom = (projectId) => encodeURIComponent(`presence:${projectId}`);

export function createProvider(room, ydoc, { connect = true } = {}) {
  if (!collabEnabled) return null;
  return new WebsocketProvider(collabUrl, room, ydoc, { connect });
}

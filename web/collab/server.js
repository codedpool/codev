// Yjs collaboration server (y-websocket protocol). Run with `npm run collab`.
// Implements the standard y-websocket sync + awareness protocol on top of the app's own yjs/y-protocols
// versions (the published @y/websocket-server targets yjs 14 and is incompatible with yjs 13 clients).
// Rooms are created on demand and live in memory; file contents persist through the app's Save.
// TODO (Phase 6): authenticate connections with Clerk and enforce project roles.
import http from 'node:http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const port = Number(process.env.COLLAB_PORT || 1234);
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const PING_MS = 30000;
const GC_AFTER_MS = 10 * 60 * 1000; // drop empty rooms after 10 minutes

/** @type {Map<string, Room>} */
const rooms = new Map();

class Room {
  constructor(name) {
    this.name = name;
    this.doc = new Y.Doc({ gc: true });
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalState(null);
    /** @type {Map<import('ws').WebSocket, Set<number>>} conn -> controlled awareness client ids */
    this.conns = new Map();
    this.gcTimer = null;

    this.awareness.on('update', ({ added, updated, removed }, origin) => {
      const changed = added.concat(updated, removed);
      if (origin && this.conns.has(origin)) {
        const ids = this.conns.get(origin);
        added.forEach((id) => ids.add(id));
        removed.forEach((id) => ids.delete(id));
      }
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed));
      this.broadcast(encoding.toUint8Array(enc));
    });
    this.doc.on('update', (update, origin) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeUpdate(enc, update);
      this.broadcast(encoding.toUint8Array(enc), origin);
    });
  }
  broadcast(buf, except) {
    for (const conn of this.conns.keys()) if (conn !== except) send(this, conn, buf);
  }
}

function getRoom(name) {
  let room = rooms.get(name);
  if (!room) {
    room = new Room(name);
    rooms.set(name, room);
  }
  if (room.gcTimer) { clearTimeout(room.gcTimer); room.gcTimer = null; }
  return room;
}

function send(room, conn, buf) {
  if (conn.readyState !== conn.OPEN && conn.readyState !== conn.CONNECTING) return closeConn(room, conn);
  try { conn.send(buf, (err) => { if (err) closeConn(room, conn); }); } catch { closeConn(room, conn); }
}

function closeConn(room, conn) {
  const ids = room.conns.get(conn);
  if (ids) {
    room.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(ids), null);
    if (room.conns.size === 0 && !room.gcTimer) {
      room.gcTimer = setTimeout(() => { if (room.conns.size === 0) { room.awareness.destroy(); room.doc.destroy(); rooms.delete(room.name); } }, GC_AFTER_MS);
    }
  }
  try { conn.close(); } catch { /* already closed */ }
}

function onMessage(room, conn, data) {
  try {
    const dec = decoding.createDecoder(new Uint8Array(data));
    const enc = encoding.createEncoder();
    const type = decoding.readVarUint(dec);
    if (type === MESSAGE_SYNC) {
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(dec, enc, room.doc, conn);
      if (encoding.length(enc) > 1) send(room, conn, encoding.toUint8Array(enc));
    } else if (type === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(dec), conn);
    }
  } catch (e) {
    console.error('[collab] bad message', e?.message || e);
  }
}

function setupConnection(conn, req) {
  conn.binaryType = 'arraybuffer';
  const name = decodeURIComponent((req.url || '/').slice(1).split('?')[0]) || 'default';
  const room = getRoom(name);
  room.conns.set(conn, new Set());
  conn.on('message', (data) => onMessage(room, conn, data));
  conn.on('close', () => closeConn(room, conn));

  // keepalive
  let alive = true;
  conn.on('pong', () => { alive = true; });
  const ping = setInterval(() => {
    if (!room.conns.has(conn)) return clearInterval(ping);
    if (!alive) { closeConn(room, conn); return clearInterval(ping); }
    alive = false;
    try { conn.ping(); } catch { closeConn(room, conn); clearInterval(ping); }
  }, PING_MS);

  // initial sync step 1 + current awareness
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(enc, room.doc);
  send(room, conn, encoding.toUint8Array(enc));
  const states = room.awareness.getStates();
  if (states.size > 0) {
    const aenc = encoding.createEncoder();
    encoding.writeVarUint(aenc, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(aenc, awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys())));
    send(room, conn, encoding.toUint8Array(aenc));
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size, connections: [...rooms.values()].reduce((n, r) => n + r.conns.size, 0) }));
  }
  res.writeHead(404); res.end();
});
const wss = new WebSocketServer({ noServer: true });
wss.on('connection', setupConnection);
server.on('upgrade', (req, socket, head) => wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req)));
server.listen(port, () => console.log(`[collab] y-websocket listening on ws://localhost:${port}`));

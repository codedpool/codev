// Single place for every backend call. Endpoint shapes are unchanged from the
// original app; new (additive) endpoints are marked.
import axios from 'axios';

export const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';

const http = axios.create({ baseURL: backendUrl });

export function errorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.error || err?.message || fallback;
}

/* ---------- Projects ---------- */
// The signed-in user is derived from the Clerk session cookie on the server.
export const listProjects = () => http.get('/api/projects').then((r) => r.data);

export const createProject = ({ projectName }) => http.post('/api/projects', { projectName }).then((r) => r.data);

export const deleteProject = (projectId) =>
  http.delete(`/api/projects/${encodeURIComponent(projectId)}`).then((r) => r.data);

// Fetch one project (with its file list); any signed-in user with the link can read it.
export const getProject = (projectId) =>
  http.get(`/api/projects/${encodeURIComponent(projectId)}`).then((r) => r.data);

/* ---------- Files ---------- */
// POST /api/files is an upsert: used both to create and to save.
export const saveFile = (projectId, fileName, content) =>
  http.post('/api/files', { projectId, fileName, content }).then((r) => r.data);

export const getFileContent = (projectId, fileName) =>
  http
    .get(`/api/files/${encodeURIComponent(projectId)}/${encodeURIComponent(fileName)}`)
    .then((r) => r.data.content);

export const deleteFile = (projectId, fileName) =>
  http
    .delete(`/api/files/${encodeURIComponent(projectId)}/${encodeURIComponent(fileName)}`)
    .then((r) => r.data);

export const renameFile = (projectId, from, to) => http.post('/api/files/rename', { projectId, from, to }).then((r) => r.data);

/** What this deployment supports: { runner, languages, ai, collab } */
export const getCapabilities = () => http.get('/api/capabilities').then((r) => r.data);

/* ---------- Git (local history, no remotes) ---------- */
export const gitCommit = (projectId, message) => http.post('/api/git/commit', { projectId, message }).then((r) => r.data);
export const gitLog = (projectId) => http.get(`/api/git/log?projectId=${encodeURIComponent(projectId)}`).then((r) => r.data);
export const gitDiff = (projectId, oid) => http.get(`/api/git/diff/${oid}?projectId=${encodeURIComponent(projectId)}`).then((r) => r.data);
export const gitRevert = (projectId, oid) => http.post('/api/git/revert', { projectId, oid }).then((r) => r.data);

/* ---------- Execution ---------- */
export const runCode = (projectId, fileName, input, signal) =>
  http.post('/api/run', { projectId, fileName, input }, { signal }).then((r) => r.data);

/* ---------- AI ---------- */
export const aiLint = (code) => http.post('/api/ai/lint', { code }).then((r) => r.data.fixes);
export const aiDocs = (code) => http.post('/api/ai/generate-docs', { code }).then((r) => r.data.docs);
export const aiSnippet = (description) =>
  http.post('/api/ai/generate-snippet', { description }).then((r) => r.data.snippet);
export const aiAutoComplete = (payload, signal) =>
  http.post('/api/ai/auto-complete', payload, { signal }).then((r) => r.data.suggestions);

// NEW (additive): streaming chat. Falls back gracefully if the server does not stream.
export async function aiChatStream({ messages, context }, { onToken, signal } = {}) {
  const res = await fetch(`${backendUrl}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
    signal,
  });
  if (!res.ok) {
    let msg = `AI request failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (!res.body) {
    const text = await res.text();
    onToken?.(text);
    return text;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    onToken?.(chunk, full);
  }
  return full;
}

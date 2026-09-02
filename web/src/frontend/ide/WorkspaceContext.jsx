'use client';
// Workspace state for the IDE: project + files, tabs, dirty tracking, saving, running,
// problems, logs, layout & settings. One provider per open project.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '../lib/nav';
import { useSession } from '../lib/session';
import * as api from '../lib/api';
import { errorMessage } from '../lib/api';
import { baseName, dirName, isRunnable, runCommandFor, templateFor, languageLabel, setRunnable, RUNNABLE } from '../lib/fileTypes';
import { runPython, warmupPyodide, pyodideSupported } from '../lib/pyodideRunner';
import { loadJSON, saveJSON } from '../lib/storage';
import { createStore } from '../lib/store';
import { useToast } from '../ui';

const WorkspaceCtx = createContext(null);

export const DEFAULT_LAYOUT = {
  sidebarOpen: true,
  sidebarView: 'explorer',
  sidebarWidth: 260,
  panelOpen: true,
  panelTab: 'terminal',
  panelHeight: 220,
  panelMaximized: false,
  aiOpen: true,
  aiWidth: 360,
};

export const DEFAULT_SETTINGS = {
  fontSize: 13,
  lineHeight: 1.6,
  tabSize: 4,
  wordWrap: false,
  minimap: true,
  ligatures: true,
  lineNumbers: true,
  theme: 'codev-dark',
  inlineAi: true,
  aiDiffPreview: true,
  pyInBrowser: false,
  autoSave: false,
  bracketPairs: true,
};

let idCounter = 0;
const uid = (p = 'id') => `${p}${Date.now().toString(36)}${(idCounter++).toString(36)}`;

// ---- Problem extraction from program output (heuristic, per language) ----
function extractProblems(output = '', file = '') {
  const problems = [];
  const lines = output.split('\n');
  const base = baseName(file);
  const seen = new Set();
  const push = (message, line, severity = 'error') => {
    const key = `${line}|${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    problems.push({ id: uid('p'), file, line: line || undefined, severity, message: message.trim(), source: 'run' });
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m;
    if ((m = l.match(/File ".*?", line (\d+)/))) {
      // Python traceback: message is usually the last non-empty line
      const last = [...lines].reverse().find((x) => x.trim() && /Error|Exception/.test(x));
      push(last || l, Number(m[1]));
    } else if ((m = l.match(new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+)(?::(\\d+))?:?\\s*(error|warning)?:?\\s*(.*)`)))) {
      push(m[4] || l, Number(m[1]), m[3] === 'warning' ? 'warning' : 'error');
    } else if (/^\s*(SyntaxError|TypeError|ReferenceError|RangeError|Error|Exception in thread|error:|fatal error:)/i.test(l)) {
      const prev = lines[i - 2] || '';
      const pm = prev.match(/:(\d+)(?::\d+)?\)?$/) || prev.match(/\.js:(\d+)/);
      push(l, pm ? Number(pm[1]) : undefined);
    }
  }
  return problems;
}

export function WorkspaceProvider({ projectId, initialFile, children }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, user } = useSession();
  // Depend on primitives so an unstable `user` object never re-triggers effects.
  const userId = user?.id || null;
  const userName = user?.name || user?.nickname || user?.email || 'Guest';
  const userEmail = user?.email || null;
  const userPicture = user?.picture || null;

  // ---------- persisted layout & settings ----------
  const [layout, setLayoutState] = useState(() => ({ ...DEFAULT_LAYOUT, ...loadJSON('layout', {}) }));
  const [settings, setSettingsState] = useState(() => ({ ...DEFAULT_SETTINGS, ...loadJSON('settings', {}) }));
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // Browser Python (Pyodide): keep .py runnable regardless of the server runner, and pre-warm the interpreter.
  useEffect(() => {
    if (settings.pyInBrowser && pyodideSupported()) { RUNNABLE.add('py'); warmupPyodide(); }
  }, [settings.pyInBrowser]);
  useEffect(() => saveJSON('layout', layout), [layout]);
  useEffect(() => saveJSON('settings', settings), [settings]);
  const setLayout = useCallback((patch) => setLayoutState((l) => ({ ...l, ...(typeof patch === 'function' ? patch(l) : patch) })), []);
  const setSettings = useCallback((patch) => setSettingsState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })), []);

  // ---------- project & files ----------
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]); // array of paths
  const [projectStatus, setProjectStatus] = useState('loading'); // loading | ready | error
  const [projectError, setProjectError] = useState(null);
  const [git, setGit] = useState({ branch: 'main', headOid: null }); // local commit history state
  const [reloadRevision, setReloadRevision] = useState(0); // bumped after a revert to force editors to remount

  const wsKey = `ws:${projectId}`;
  const persisted = useMemo(() => loadJSON(wsKey, {}), [wsKey]);
  const [emptyFolders, setEmptyFolders] = useState(persisted.emptyFolders || []);
  const [expandedDirs, setExpandedDirs] = useState(persisted.expandedDirs || []);
  const [tabs, setTabs] = useState(() => {
    const t = persisted.tabs || [];
    if (initialFile && !t.includes(initialFile)) return [...t, initialFile];
    return t;
  });
  const [activeTab, setActiveTabState] = useState(initialFile || persisted.activeTab || null);
  const tabsRef = useRef(tabs);
  const activeTabRef = useRef(activeTab);
  tabsRef.current = tabs;
  activeTabRef.current = activeTab;
  useEffect(() => saveJSON(wsKey, { tabs, activeTab, emptyFolders, expandedDirs }), [wsKey, tabs, activeTab, emptyFolders, expandedDirs]);

  const loadProject = useCallback(async () => {
    setProjectStatus('loading');
    setProjectError(null);
    try {
      let p = null;
      try {
        p = await api.getProject(projectId);
      } catch (e) {
        // Backend without the new endpoint: fall back to listing the owner's projects.
        if (isAuthenticated && userId) {
          const list = await api.listProjects();
          p = list.find((x) => x.projectId === projectId) || null;
        }
        if (!p) throw e;
      }
      setProject({ projectId: p.projectId, projectName: p.projectName || 'Untitled project' });
      setFiles((p.files || []).map((f) => f.fileName).filter(Boolean).sort());
      setGit(p.git || { branch: 'main', headOid: null });
      setProjectStatus('ready');
    } catch (e) {
      // Degrade: single-file mode from the URL (e.g. shared link on an older backend).
      setProject({ projectId, projectName: 'Workspace' });
      setFiles(initialFile ? [initialFile] : []);
      setProjectStatus(initialFile ? 'ready' : 'error');
      setProjectError(errorMessage(e, 'Could not load project'));
    }
  }, [projectId, isAuthenticated, userId, initialFile]);
  useEffect(() => { loadProject(); }, [loadProject]);

  // ---------- server capabilities (runner languages, AI, collab) ----------
  const [capabilities, setCapabilities] = useState({ runner: 'unknown', languages: null, ai: true, collab: false });
  useEffect(() => {
    let alive = true;
    api.getCapabilities().then((c) => { if (!alive) return; setRunnable(c.languages); if (settingsRef.current?.pyInBrowser && pyodideSupported()) RUNNABLE.add('py'); setCapabilities(c); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // ---------- content, dirty & untracked ----------
  const contentsRef = useRef(new Map()); // path -> current content
  const savedRef = useRef(new Map()); // path -> last saved content
  const [dirty, setDirty] = useState(() => new Set());
  const [untracked, setUntracked] = useState(() => new Set());
  const [saving, setSaving] = useState(() => new Set());
  const editorRef = useRef(null); // active editor api
  const cursorStore = useMemo(() => createStore({ line: 1, col: 1, selChars: 0, selLines: 0, selections: 1, hasSelection: false }), []);
  const [syncStatus, setSyncStatus] = useState('connecting');

  const markDirty = useCallback((path, isDirty) => {
    setDirty((d) => {
      if (d.has(path) === isDirty) return d;
      const n = new Set(d);
      if (isDirty) n.add(path); else n.delete(path);
      return n;
    });
  }, []);

  const handleContentChange = useCallback(
    (path, content) => {
      contentsRef.current.set(path, content);
      const saved = savedRef.current.get(path);
      markDirty(path, saved !== undefined && saved !== content);
    },
    [markDirty]
  );

  const handleLoaded = useCallback(
    (path, content) => {
      if (content == null) return;
      if (!savedRef.current.has(path)) savedRef.current.set(path, content);
      if (!contentsRef.current.has(path)) contentsRef.current.set(path, content);
      const cur = contentsRef.current.get(path);
      markDirty(path, cur !== savedRef.current.get(path));
    },
    [markDirty]
  );

  const getContent = useCallback(
    async (path) => {
      if (contentsRef.current.has(path)) return contentsRef.current.get(path);
      const c = await api.getFileContent(projectId, path);
      if (!savedRef.current.has(path)) savedRef.current.set(path, c);
      contentsRef.current.set(path, c);
      return c;
    },
    [projectId]
  );

  // ---------- logs & problems ----------
  const [logs, setLogs] = useState([]);
  const log = useCallback((level, message, meta) => {
    setLogs((l) => [...l.slice(-499), { id: uid('l'), ts: Date.now(), level, message, meta }]);
  }, []);
  const clearLogs = useCallback(() => setLogs([]), []);
  const [problems, setProblems] = useState([]);
  const addProblems = useCallback((items) => setProblems((p) => [...p.filter((x) => !items.some((i) => i.source === x.source && i.file === x.file)), ...items]), []);
  const clearProblems = useCallback((source) => setProblems((p) => (source ? p.filter((x) => x.source !== source) : [])), []);

  // ---------- tabs ----------
  const setActiveTab = useCallback(
    (path) => {
      setActiveTabState(path);
      if (path) navigate(`/ide/${encodeURIComponent(projectId)}/${path.split('/').map(encodeURIComponent).join('/')}`, { replace: true });
      else navigate(`/ide/${encodeURIComponent(projectId)}`, { replace: true });
    },
    [navigate, projectId]
  );
  const openFile = useCallback(
    (path) => {
      setTabs((t) => (t.includes(path) ? t : [...t, path]));
      setActiveTab(path);
    },
    [setActiveTab]
  );
  const closeTab = useCallback(
    (path) => {
      const t = tabsRef.current;
      const idx = t.indexOf(path);
      const next = t.filter((x) => x !== path);
      setTabs(next);
      if (activeTabRef.current === path) setActiveTab(next[Math.min(idx, next.length - 1)] || null);
    },
    [setActiveTab]
  );
  const closeTabs = useCallback(
    (paths) => {
      const next = tabsRef.current.filter((x) => !paths.includes(x));
      setTabs(next);
      const cur = activeTabRef.current;
      if (!cur || !next.includes(cur)) setActiveTab(next[next.length - 1] || null);
    },
    [setActiveTab]
  );
  const moveTab = useCallback((from, to) => {
    setTabs((t) => {
      const arr = [...t];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  }, []);

  // ---------- file operations ----------
  const createFile = useCallback(
    async (path, content) => {
      const clean = path.replace(/^\/+/, '').replace(/\/+/g, '/').trim();
      if (!clean) throw new Error('File name is required');
      if (files.includes(clean)) throw new Error('A file with that name already exists');
      const body = content ?? templateFor(clean);
      await api.saveFile(projectId, clean, body);
      savedRef.current.set(clean, body);
      contentsRef.current.set(clean, body);
      setFiles((f) => [...f, clean].sort());
      setUntracked((u) => new Set(u).add(clean));
      const dir = dirName(clean);
      if (dir) {
        setEmptyFolders((ef) => ef.filter((x) => x !== dir && !dir.startsWith(x + '/')));
        setExpandedDirs((ed) => (ed.includes(dir) ? ed : [...ed, dir]));
      }
      log('info', `Created ${clean}`);
      openFile(clean);
      return clean;
    },
    [files, projectId, log, openFile]
  );

  const createFolder = useCallback((path) => {
    const clean = path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/').trim();
    if (!clean) throw new Error('Folder name is required');
    setEmptyFolders((ef) => (ef.includes(clean) ? ef : [...ef, clean]));
    setExpandedDirs((ed) => {
      const parts = clean.split('/');
      const all = parts.map((_, i) => parts.slice(0, i + 1).join('/'));
      return Array.from(new Set([...ed, ...all]));
    });
    return clean;
  }, []);

  const saveFileByPath = useCallback(
    async (path, { silent } = {}) => {
      if (!path) return false;
      const content = contentsRef.current.get(path);
      if (content === undefined) return false;
      setSaving((s) => new Set(s).add(path));
      try {
        await api.saveFile(projectId, path, content);
        savedRef.current.set(path, content);
        markDirty(path, contentsRef.current.get(path) !== content);
        setUntracked((u) => { if (!u.has(path)) return u; const n = new Set(u); n.delete(path); return n; });
        log('info', `Saved ${path}`);
        if (!silent) toast({ kind: 'success', title: 'Saved', description: baseName(path), duration: 1800 });
        return true;
      } catch (e) {
        log('error', `Save failed for ${path}: ${errorMessage(e)}`);
        toast({ kind: 'error', title: 'Save failed', description: errorMessage(e), actions: [{ label: 'Retry', onClick: () => saveFileByPath(path) }] });
        return false;
      } finally {
        setSaving((s) => { const n = new Set(s); n.delete(path); return n; });
      }
    },
    [projectId, markDirty, log, toast]
  );
  const saveActive = useCallback((opts) => saveFileByPath(activeTab, opts), [saveFileByPath, activeTab]);
  const saveAll = useCallback(async () => {
    const list = Array.from(dirty);
    if (!list.length) return;
    await Promise.all(list.map((p) => saveFileByPath(p, { silent: true })));
    toast({ kind: 'success', title: `Saved ${list.length} file${list.length > 1 ? 's' : ''}`, duration: 1800 });
  }, [dirty, saveFileByPath, toast]);

  // ---------- git (local commit history, no remotes) ----------
  const [committing, setCommitting] = useState(false);
  const commitAll = useCallback(
    async (message) => {
      if (committing) return null;
      setCommitting(true);
      try {
        await saveAll();
        const res = await api.gitCommit(projectId, message);
        if (!res.committed) {
          toast({ kind: 'info', title: 'Nothing to commit', description: res.message, duration: 2000 });
          return res;
        }
        setGit({ branch: res.branch, headOid: res.oid });
        log('info', `Committed ${res.oid.slice(0, 7)}: "${message || 'Update files'}"`);
        toast({ kind: 'success', title: 'Committed', description: res.oid.slice(0, 7), duration: 1800 });
        return res;
      } catch (e) {
        log('error', `Commit failed: ${errorMessage(e)}`);
        toast({ kind: 'error', title: 'Commit failed', description: errorMessage(e) });
        return null;
      } finally {
        setCommitting(false);
      }
    },
    [committing, saveAll, projectId, toast, log]
  );
  const gitHistory = useCallback(() => api.gitLog(projectId), [projectId]);
  const gitCommitDiff = useCallback((oid) => api.gitDiff(projectId, oid), [projectId]);
  const revertToCommit = useCallback(
    async (oid) => {
      try {
        const res = await api.gitRevert(projectId, oid);
        // Reset local buffers to the reverted content. If the active tab has a live editor open
        // (possibly on a Yjs document already synced from before the revert), push the new content
        // through it directly — reloading from storage alone wouldn't overwrite an existing
        // collaborative document, since every client thinks its in-memory copy is already "synced".
        contentsRef.current.clear();
        savedRef.current.clear();
        for (const [path, content] of Object.entries(res.contents || {})) {
          contentsRef.current.set(path, content);
          savedRef.current.set(path, content);
        }
        setDirty(new Set());
        setUntracked(new Set());
        setFiles(res.files.slice().sort());
        setGit((g) => ({ ...g, headOid: res.oid }));
        const ed = editorRef.current;
        if (ed && Object.prototype.hasOwnProperty.call(res.contents || {}, ed.file)) {
          ed.replaceAll(res.contents[ed.file]);
        } else {
          setReloadRevision((r) => r + 1); // no matching live editor — force a full remount instead
        }
        log('info', `Reverted to ${oid.slice(0, 7)} (new commit ${res.oid.slice(0, 7)})`);
        toast({ kind: 'success', title: 'Reverted', description: `to ${oid.slice(0, 7)}`, duration: 1800 });
        return res;
      } catch (e) {
        log('error', `Revert failed: ${errorMessage(e)}`);
        toast({ kind: 'error', title: 'Revert failed', description: errorMessage(e) });
        return null;
      }
    },
    [projectId, toast, log]
  );

  const deleteFileByPath = useCallback(
    async (path) => {
      await api.deleteFile(projectId, path);
      setFiles((f) => f.filter((x) => x !== path));
      contentsRef.current.delete(path);
      savedRef.current.delete(path);
      markDirty(path, false);
      setUntracked((u) => { const n = new Set(u); n.delete(path); return n; });
      closeTab(path);
      log('info', `Deleted ${path}`);
    },
    [projectId, markDirty, closeTab, log]
  );

  const deleteFolder = useCallback(
    async (dir) => {
      const inside = files.filter((f) => f.startsWith(dir + '/'));
      for (const f of inside) await api.deleteFile(projectId, f);
      setFiles((fs) => fs.filter((f) => !f.startsWith(dir + '/')));
      setEmptyFolders((ef) => ef.filter((x) => x !== dir && !x.startsWith(dir + '/')));
      inside.forEach((f) => { contentsRef.current.delete(f); savedRef.current.delete(f); markDirty(f, false); });
      closeTabs(inside);
      log('info', `Deleted folder ${dir} (${inside.length} files)`);
    },
    [files, projectId, markDirty, closeTabs, log]
  );

  const renameFile = useCallback(
    async (oldPath, newPath) => {
      const clean = newPath.replace(/^\/+/, '').replace(/\/+/g, '/').trim();
      if (!clean || clean === oldPath) return oldPath;
      if (files.includes(clean)) throw new Error('A file with that name already exists');
      const content = contentsRef.current.get(oldPath);
      await api.renameFile(projectId, oldPath, clean);
      if (content !== undefined) contentsRef.current.set(clean, content);
      if (savedRef.current.has(oldPath)) savedRef.current.set(clean, savedRef.current.get(oldPath));
      contentsRef.current.delete(oldPath);
      savedRef.current.delete(oldPath);
      setFiles((f) => [...f.filter((x) => x !== oldPath), clean].sort());
      setUntracked((u) => { const n = new Set(u); if (n.has(oldPath)) { n.delete(oldPath); n.add(clean); } return n; });
      markDirty(oldPath, false);
      setTabs((t) => t.map((x) => (x === oldPath ? clean : x)));
      if (activeTabRef.current === oldPath) setActiveTab(clean);
      log('info', `Renamed ${oldPath} → ${clean}`);
      return clean;
    },
    [files, projectId, markDirty, setActiveTab, log]
  );

  const renameFolder = useCallback(
    async (dir, newDir) => {
      const clean = newDir.replace(/^\/+|\/+$/g, '').trim();
      if (!clean || clean === dir) return;
      const inside = files.filter((f) => f.startsWith(dir + '/'));
      await api.renameFile(projectId, dir + '/', clean + '/');
      for (const f of inside) {
        const target = clean + f.slice(dir.length);
        if (contentsRef.current.has(f)) { contentsRef.current.set(target, contentsRef.current.get(f)); contentsRef.current.delete(f); }
        if (savedRef.current.has(f)) { savedRef.current.set(target, savedRef.current.get(f)); savedRef.current.delete(f); }
      }
      setFiles((fs) => [...fs.filter((f) => !f.startsWith(dir + '/')), ...inside.map((f) => clean + f.slice(dir.length))].sort());
      setEmptyFolders((ef) => ef.map((x) => (x === dir || x.startsWith(dir + '/') ? clean + x.slice(dir.length) : x)));
      setExpandedDirs((ed) => ed.map((x) => (x === dir || x.startsWith(dir + '/') ? clean + x.slice(dir.length) : x)));
      setTabs((t) => t.map((x) => (x.startsWith(dir + '/') ? clean + x.slice(dir.length) : x)));
      const cur = activeTabRef.current;
      if (cur && cur.startsWith(dir + '/')) setActiveTab(clean + cur.slice(dir.length));
      log('info', `Renamed folder ${dir} → ${clean}`);
    },
    [files, projectId, setActiveTab, log]
  );

  const uploadFiles = useCallback(
    async (fileList, dir = '') => {
      const arr = Array.from(fileList || []);
      let ok = 0;
      for (const f of arr) {
        const path = dir ? `${dir}/${f.name}` : f.name;
        try {
          const text = await f.text();
          await api.saveFile(projectId, path, text);
          savedRef.current.set(path, text);
          contentsRef.current.set(path, text);
          setFiles((fs) => (fs.includes(path) ? fs : [...fs, path].sort()));
          setUntracked((u) => new Set(u).add(path));
          ok++;
        } catch (e) {
          toast({ kind: 'error', title: `Upload failed: ${f.name}`, description: errorMessage(e) });
        }
      }
      if (ok) {
        toast({ kind: 'success', title: `Uploaded ${ok} file${ok > 1 ? 's' : ''}` });
        log('info', `Uploaded ${ok} file(s)${dir ? ` to ${dir}` : ''}`);
        if (arr.length === 1 && ok === 1) openFile(dir ? `${dir}/${arr[0].name}` : arr[0].name);
      }
    },
    [projectId, toast, log, openFile]
  );

  // ---------- run ----------
  const [stdin, setStdin] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [sessions, setSessions] = useState([]);
  const runAbort = useRef(null);

  const run = useCallback(
    async (path = activeTab) => {
      if (!path || isRunning) return;
      if (!isRunnable(path)) {
        toast({ kind: 'warn', title: 'Cannot run this file', description: capabilities.runner === 'none' ? 'No code runner is configured on the server.' : `${languageLabel(path)} isn't supported by the configured runner.` });
        return;
      }
      setIsRunning(true);
      setLayout({ panelOpen: true, panelTab: 'terminal' });
      const id = uid('run');
      const ext = path.split('.').pop().toLowerCase();
      const inBrowser = ext === 'py' && settingsRef.current?.pyInBrowser && pyodideSupported();
      const command = inBrowser ? `python ${baseName(path)}  # in browser (Pyodide)` : runCommandFor(path);
      const startedAt = Date.now();
      setSessions((s) => [...s.slice(-49), { id, file: path, command, startedAt, status: 'running', output: '', stdin, runner: inBrowser ? 'pyodide' : undefined }]);
      log('info', `Run started: ${command}`);
      clearProblems('run');
      const execInBrowser = async (note) => {
          const ctrl = new AbortController();
          runAbort.current = ctrl;
          const code = contentsRef.current.get(path) ?? (await getContent(path));
          let result;
          try {
            result = await runPython({
              code, stdin, fileName: baseName(path), signal: ctrl.signal, timeoutMs: 15000,
              onStatus: (st) => { if (st === 'loading') setSessions((s) => s.map((x) => (x.id === id ? { ...x, output: 'Downloading the Python runtime (first run only)…\n' } : x))); },
              onOutput: (text) => setSessions((s) => s.map((x) => (x.id === id ? { ...x, output: (x.output.startsWith('Downloading') ? '' : x.output) + text } : x))),
            });
          } catch (e) {
            if (e?.name === 'AbortError') throw e;
            result = { output: `${e.output || ''}
[${e.message}]
`, exitCode: 124 };
          }
          const endedAt = Date.now();
          const problems = extractProblems(result.output, path);
          const failed = result.exitCode !== 0 || problems.some((p) => p.severity === 'error');
          setSessions((s) => s.map((x) => (x.id === id ? { ...x, status: failed ? 'error' : 'done', output: result.output, exitCode: result.exitCode, time: result.time, endedAt } : x)));
          if (problems.length) addProblems(problems);
          log(failed ? 'warn' : 'info', `Run finished in ${endedAt - startedAt}ms${failed ? ' with errors' : ''} (browser)`);
          if (note) setSessions((s) => s.map((x) => (x.id === id ? { ...x, command: `python ${baseName(path)}  # in browser (Pyodide)`, output: `${note}
${x.output}` } : x)));
      };
      try {
        if (inBrowser) { await execInBrowser(); return; }
        // The runner reads from storage, so save first (unchanged behaviour).
        if (contentsRef.current.has(path)) {
          const ok = await saveFileByPath(path, { silent: true });
          if (!ok) throw new Error('Could not save file before running');
        }
        const ctrl = new AbortController();
        runAbort.current = ctrl;
        const result = await api.runCode(projectId, path, stdin, ctrl.signal);
        const output = result?.output ?? '';
        const endedAt = Date.now();
        const problems = extractProblems(output, path);
        const failed = (result?.exitCode != null && result.exitCode !== 0) || problems.some((p) => p.severity === 'error');
        setSessions((s) => s.map((x) => (x.id === id ? { ...x, status: failed ? 'error' : 'done', output, exitCode: result?.exitCode, time: result?.time, endedAt } : x)));
        if (problems.length) addProblems(problems);
        log(failed ? 'warn' : 'info', `Run finished in ${endedAt - startedAt}ms${failed ? ' with errors' : ''}`);
      } catch (e) {
        const status = e?.response?.status;
        if (ext === 'py' && pyodideSupported() && (status === 429 || status === 502 || status === 503 || status === 504)) {
          toast({ kind: 'info', title: 'Server runner unavailable', description: 'Running Python in your browser instead (Pyodide).', duration: 2500 });
          try { await execInBrowser('[server runner unavailable — ran in the browser with Pyodide]'); return; } catch (e2) { if (e2?.name !== 'AbortError') e = e2; }
        }
        const endedAt = Date.now();
        const aborted = e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError';
        const msg = aborted ? 'Run stopped.' : errorMessage(e, 'Failed to run code');
        setSessions((s) => s.map((x) => (x.id === id ? { ...x, status: aborted ? 'stopped' : 'error', error: msg, endedAt } : x)));
        if (!aborted) {
          addProblems([{ id: uid('p'), file: path, severity: 'error', message: msg, source: 'run' }]);
          log('error', `Run failed: ${msg}`);
        } else log('warn', 'Run stopped by user');
      } finally {
        runAbort.current = null;
        setIsRunning(false);
      }
    },
    [activeTab, isRunning, stdin, projectId, toast, setLayout, log, clearProblems, saveFileByPath, addProblems, capabilities.runner, getContent]
  );
  const stop = useCallback(() => { runAbort.current?.abort(); }, []);
  const clearSessions = useCallback(() => setSessions([]), []);

  // ---------- auto save ----------
  useEffect(() => {
    if (!settings.autoSave || !dirty.size) return;
    const t = setTimeout(() => { Array.from(dirty).forEach((p) => saveFileByPath(p, { silent: true })); }, 1500);
    return () => clearTimeout(t);
  }, [settings.autoSave, dirty, saveFileByPath]);

  // ---------- unload guard ----------
  useEffect(() => {
    const onBeforeUnload = (e) => { if (dirty.size) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ---------- UI state (palette, dialogs) ----------
  const [palette, setPalette] = useState({ open: false, mode: 'commands' });
  const openPalette = useCallback((mode = 'commands', query = '') => setPalette({ open: true, mode, query }), []);
  const closePalette = useCallback(() => setPalette((p) => ({ ...p, open: false })), []);
  const [dialog, setDialog] = useState(null); // { type, ...data }
  const openDialog = useCallback((type, data = {}) => setDialog({ type, ...data }), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  // ---------- layout helpers ----------
  const toggleSidebar = useCallback((view) => {
    setLayout((l) => {
      if (view && view !== l.sidebarView) return { sidebarView: view, sidebarOpen: true };
      return { sidebarOpen: !l.sidebarOpen };
    });
  }, [setLayout]);
  const togglePanel = useCallback((tab) => {
    setLayout((l) => {
      if (tab && (tab !== l.panelTab || !l.panelOpen)) return { panelTab: tab, panelOpen: true };
      return { panelOpen: !l.panelOpen, panelMaximized: false };
    });
  }, [setLayout]);
  const toggleAi = useCallback(() => setLayout((l) => ({ aiOpen: !l.aiOpen })), [setLayout]);

  const currentUser = useMemo(() => ({ id: userId || 'guest', name: userName, avatar: userPicture, email: userEmail }), [userId, userName, userPicture, userEmail]);

  const value = useMemo(
    () => ({
      projectId, project, files, projectStatus, projectError, reloadProject: loadProject,
      emptyFolders, expandedDirs, setExpandedDirs,
      tabs, activeTab, openFile, closeTab, closeTabs, moveTab, setActiveTab,
      dirty, untracked, saving, syncStatus, setSyncStatus,
      contentsRef, savedRef, getContent, handleContentChange, handleLoaded,
      editorRef, cursorStore,
      createFile, createFolder, renameFile, renameFolder, deleteFile: deleteFileByPath, deleteFolder, uploadFiles,
      saveFile: saveFileByPath, saveActive, saveAll,
      run, stop, isRunning, sessions, clearSessions, stdin, setStdin,
      problems, addProblems, clearProblems, logs, log, clearLogs,
      layout, setLayout, toggleSidebar, togglePanel, toggleAi,
      settings, setSettings,
      palette, openPalette, closePalette, dialog, openDialog, closeDialog,
      currentUser, isAuthenticated, capabilities,
      git, committing, commitAll, gitHistory, gitCommitDiff, revertToCommit, reloadRevision,
    }),
    [projectId, project, files, projectStatus, projectError, loadProject, emptyFolders, expandedDirs, tabs, activeTab, openFile, closeTab, closeTabs, moveTab, setActiveTab, dirty, untracked, saving, syncStatus, getContent, handleContentChange, handleLoaded, cursorStore, createFile, createFolder, renameFile, renameFolder, deleteFileByPath, deleteFolder, uploadFiles, saveFileByPath, saveActive, saveAll, run, stop, isRunning, sessions, clearSessions, stdin, problems, addProblems, clearProblems, logs, log, clearLogs, layout, setLayout, toggleSidebar, togglePanel, toggleAi, settings, setSettings, palette, openPalette, closePalette, dialog, openDialog, closeDialog, currentUser, isAuthenticated, capabilities, git, committing, commitAll, gitHistory, gitCommitDiff, revertToCommit, reloadRevision]
  );

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}

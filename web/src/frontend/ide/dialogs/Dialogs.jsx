'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { diffLines } from 'diff';
import { useSession } from '../../lib/session';
import { Copy, Check, Mail, Link2, AlertTriangle, LogOut, Sparkles, GitCommitHorizontal, RotateCcw, ChevronLeft, FilePlus2, FileMinus2, FileEdit } from 'lucide-react';
import { Modal, Button, Input, Field, Select, Switch, Kbd, useToast, Avatar, Spinner, EmptyState } from '../../ui';
import { useWorkspace, DEFAULT_SETTINGS } from '../WorkspaceContext';
import { CREATABLE_TYPES, baseName, dirName, extOf } from '../../lib/fileTypes';
import { EDITOR_THEMES } from '../../editor/theme';
import { SHORTCUTS } from '../commands.jsx';
import { shortcutParts } from '../../lib/keyboard';
import FileIcon from '../FileIcon';

/* ---------------- New file ---------------- */
function NewFileDialog({ data, onClose }) {
  const { files, createFile, activeTab, emptyFolders } = useWorkspace();
  const { toast } = useToast();
  const suggestedExt = data.suggestedExt && CREATABLE_TYPES.some((t) => t.ext === data.suggestedExt) ? data.suggestedExt : (activeTab ? extOf(activeTab) : 'py');
  const [name, setName] = useState('');
  const [ext, setExt] = useState(CREATABLE_TYPES.some((t) => t.ext === suggestedExt) ? suggestedExt : 'py');
  const [dir, setDir] = useState(data.dir ?? (activeTab ? dirName(activeTab) : ''));
  const [busy, setBusy] = useState(false);
  const dirs = useMemo(() => Array.from(new Set([...files.map(dirName).filter(Boolean), ...emptyFolders])).sort(), [files, emptyFolders]);
  const hasExt = /\.[a-z0-9]+$/i.test(name.trim());
  const full = (dir ? `${dir}/` : '') + name.trim() + (hasExt ? '' : `.${ext}`);
  const exists = files.includes(full);
  const invalid = /[\\/]/.test(name);
  const submit = async () => {
    if (!name.trim() || exists || busy) return;
    setBusy(true);
    try {
      await createFile(full, data.content);
      toast({ kind: 'success', title: 'File created', description: full, duration: 1800 });
      onClose();
    } catch (e) {
      toast({ kind: 'error', title: 'Could not create file', description: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open title="New file" onClose={onClose} description={data.content ? 'The generated code will be written into this file.' : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!name.trim() || exists} loading={busy}>Create</Button></>}
    >
      <Field label="File name" error={exists ? 'A file with this name already exists' : null} hint={name.trim() ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileIcon name={full} size="sm" />{full}</span> : 'Extension is added automatically if omitted'}>
        <div className="cv-field__row">
          <Input data-autofocus placeholder="main" value={name} invalid={exists || invalid} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} style={{ flex: 1 }} mono />
          <Select value={ext} onChange={(e) => setExt(e.target.value)} disabled={hasExt} style={{ width: 130 }}>
            {CREATABLE_TYPES.map((t) => <option key={t.ext} value={t.ext}>.{t.ext} · {t.label}</option>)}
          </Select>
        </div>
      </Field>
      <Field label="Folder" hint="Type a new folder path to create it, e.g. src/utils">
        <Input mono placeholder="(project root)" value={dir} onChange={(e) => setDir(e.target.value.replace(/^\/+|\/+$/g, ''))} list="cv-dirs" />
        <datalist id="cv-dirs">{dirs.map((d) => <option key={d} value={d} />)}</datalist>
      </Field>
    </Modal>
  );
}

/* ---------------- New folder ---------------- */
function NewFolderDialog({ data, onClose }) {
  const { createFolder, toggleSidebar } = useWorkspace();
  const [name, setName] = useState(data.dir ? `${data.dir}/` : '');
  const submit = () => {
    if (!name.trim()) return;
    createFolder(name);
    toggleSidebar('explorer');
    onClose();
  };
  return (
    <Modal open title="New folder" onClose={onClose} size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!name.trim()}>Create</Button></>}>
      <Field label="Folder path" hint="Folders are created when you add a file inside them; empty folders stay local until then.">
        <Input data-autofocus mono placeholder="src/components" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      </Field>
    </Modal>
  );
}

/* ---------------- Rename ---------------- */
function RenameDialog({ data, onClose }) {
  const { renameFile, files } = useWorkspace();
  const { toast } = useToast();
  const [name, setName] = useState(baseName(data.path || ''));
  const [busy, setBusy] = useState(false);
  const target = (dirName(data.path) ? `${dirName(data.path)}/` : '') + name.trim();
  const exists = target !== data.path && files.includes(target);
  const submit = async () => {
    if (!name.trim() || exists || target === data.path) return onClose();
    setBusy(true);
    try { await renameFile(data.path, target); onClose(); } catch (e) { toast({ kind: 'error', title: 'Rename failed', description: e.message }); } finally { setBusy(false); }
  };
  return (
    <Modal open title="Rename file" onClose={onClose} size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!name.trim() || exists} loading={busy}>Rename</Button></>}>
      <Field label="New name" error={exists ? 'A file with this name already exists' : null} hint={dirName(data.path) ? `in ${dirName(data.path)}/` : null}>
        <Input data-autofocus mono value={name} invalid={exists} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      </Field>
    </Modal>
  );
}

/* ---------------- Confirm delete ---------------- */
function ConfirmDeleteDialog({ data, onClose }) {
  const { deleteFile, deleteFolder, files, dirty } = useWorkspace();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const inside = data.isDir ? files.filter((f) => f.startsWith(data.path + '/')) : [];
  const unsaved = data.isDir ? inside.some((f) => dirty.has(f)) : dirty.has(data.path);
  const submit = async () => {
    setBusy(true);
    try {
      if (data.isDir) await deleteFolder(data.path); else await deleteFile(data.path);
      toast({ kind: 'info', title: `Deleted ${baseName(data.path)}`, duration: 1800 });
      onClose();
    } catch (e) {
      toast({ kind: 'error', title: 'Delete failed', description: e.message });
      setBusy(false);
    }
  };
  return (
    <Modal open title={`Delete ${data.isDir ? 'folder' : 'file'}?`} onClose={onClose} size="sm"
      footer={<><Button variant="ghost" onClick={onClose} data-autofocus>Cancel</Button><Button variant="danger-solid" onClick={submit} loading={busy}>Delete</Button></>}
    >
      <div className={`notice ${unsaved ? 'notice--warn' : ''}`}>
        <span className="notice__icon"><AlertTriangle /></span>
        <div>
          <div className="notice__title" style={{ fontFamily: 'var(--font-mono)' }}>{data.path}</div>
          <div className="notice__desc">
            {data.isDir ? `This permanently deletes ${inside.length} file${inside.length === 1 ? '' : 's'} inside the folder.` : 'This permanently removes the file from the project.'}
            {unsaved ? ' Unsaved changes will be lost.' : ''}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Share ---------------- */
function ShareDialog({ onClose }) {
  const ws = useWorkspace();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const link = `${window.location.origin}/ide/${encodeURIComponent(ws.projectId)}${ws.activeTab ? '/' + ws.activeTab.split('/').map(encodeURIComponent).join('/') : ''}`;
  const copy = () => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); toast({ kind: 'success', title: 'Link copied', duration: 1500 }); };
  const invite = () => {
    const subject = encodeURIComponent(`Join me on Codev: ${ws.project?.projectName || 'workspace'}`);
    const body = encodeURIComponent(`Let's code together.\n\nOpen the workspace: ${link}`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    ws.log('info', `Invite sent to ${email}`);
    toast({ kind: 'success', title: 'Invitation opened in your mail app' });
  };
  return (
    <Modal open title="Share workspace" onClose={onClose} description="Anyone with the link can open this project and edit with you in real time.">
      <Field label="Workspace link">
        <div className="share-link">
          <Input mono readOnly value={link} onFocus={(e) => e.target.select()} data-autofocus />
          <Button variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
        </div>
      </Field>
      <Field label="Invite by email">
        <div className="share-link">
          <Input type="email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && email.includes('@')) invite(); }} icon={<Mail />} />
          <Button variant="primary" onClick={invite} disabled={!email.includes('@')}>Invite</Button>
        </div>
      </Field>
      <div className="sidebar__note" style={{ display: 'flex', gap: 8 }}><Link2 style={{ width: 13, height: 13, flex: 'none', marginTop: 2 }} /><span>Links open the file you are currently viewing. Collaborators appear in the top bar and next to files they have open.</span></div>
    </Modal>
  );
}

/* ---------------- History (local git log, diff, revert) ---------------- */
function CommitDiff({ diff }) {
  if (!diff) return <Spinner size="sm" />;
  if (!diff.files.length) return <div className="sidebar__hint">No file changes in this commit.</div>;
  return (
    <div className="history__diff">
      {diff.files.map((f) => {
        const parts = diffLines(f.before, f.after);
        return (
          <div key={f.path} className="history__file">
            <div className="history__file-head">
              {f.status === 'added' ? <FilePlus2 style={{ width: 13, height: 13, color: 'var(--success)' }} /> : f.status === 'deleted' ? <FileMinus2 style={{ width: 13, height: 13, color: 'var(--danger)' }} /> : <FileEdit style={{ width: 13, height: 13, color: 'var(--warn)' }} />}
              <FileIcon name={f.path} size="sm" />
              <span className="u-truncate">{f.path}</span>
              <span className="cv-badge" style={{ marginLeft: 'auto' }}>{f.status}</span>
            </div>
            <pre className="history__code">
              {parts.map((p, i) => (
                <span key={i} className={p.added ? 'diff-add' : p.removed ? 'diff-del' : ''}>
                  {p.value.split('\n').filter((_, li, arr) => li < arr.length - 1 || _.length).map((line, li) => (
                    <span key={li} className="diff-line">{p.added ? '+ ' : p.removed ? '- ' : '  '}{line}{'\n'}</span>
                  ))}
                </span>
              ))}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function HistoryDialog({ onClose }) {
  const { projectId, git, gitHistory, gitCommitDiff, revertToCommit } = useWorkspace();
  const { toast } = useToast();
  const [commits, setCommits] = useState(null); // null = loading
  const [selected, setSelected] = useState(null);
  const [diff, setDiff] = useState(null);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    let alive = true;
    gitHistory().then((r) => { if (alive) setCommits(r.commits); }).catch(() => { if (alive) setCommits([]); });
    return () => { alive = false; };
  }, [gitHistory, git.headOid]);

  const open = (oid) => {
    setSelected(oid);
    setDiff(null);
    gitCommitDiff(oid).then(setDiff).catch(() => setDiff({ files: [] }));
  };

  const revert = async (oid) => {
    setReverting(true);
    const res = await revertToCommit(oid);
    setReverting(false);
    if (res) onClose();
  };

  const commit = selected ? commits?.find((c) => c.oid === selected) : null;

  return (
    <Modal open title={selected ? 'Commit details' : 'History'} onClose={onClose} size="lg" description={selected ? null : `Local commit history on ${git.branch} — ${commits?.length ?? '…'} commit${commits?.length === 1 ? '' : 's'}. Nothing here is pushed anywhere; this is Codev's own version history.`}>
      {selected ? (
        <>
          <button type="button" className="cv-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 10 }} onClick={() => setSelected(null)}>
            <ChevronLeft style={{ width: 14, height: 14 }} /> Back to history
          </button>
          {commit ? (
            <div className="history__meta">
              <div className="history__msg">{commit.message}</div>
              <div className="sidebar__hint">{commit.author} · {new Date(commit.date).toLocaleString()} · <code>{commit.oid.slice(0, 7)}</code></div>
            </div>
          ) : null}
          <CommitDiff diff={diff} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="secondary" icon={<RotateCcw />} onClick={() => revert(selected)} disabled={reverting || selected === git.headOid}>
              {reverting ? 'Reverting…' : selected === git.headOid ? 'Already at this commit' : 'Revert project to this commit'}
            </Button>
          </div>
        </>
      ) : commits === null ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><Spinner /></div>
      ) : !commits.length ? (
        <EmptyState compact icon={<GitCommitHorizontal />} title="No commits yet" description="Use Source Control → Commit to save your first snapshot." />
      ) : (
        <div className="sidebar__list">
          {commits.map((c) => (
            <button type="button" key={c.oid} className="history__row" onClick={() => open(c.oid)}>
              <GitCommitHorizontal style={{ width: 14, height: 14, color: c.oid === git.headOid ? 'var(--accent)' : 'var(--text-3)', flex: 'none' }} />
              <div className="history__row-body">
                <div className="u-truncate">{c.message}</div>
                <div className="sidebar__hint" style={{ margin: 0 }}>{c.author} · {new Date(c.date).toLocaleString()}</div>
              </div>
              <code className="history__oid">{c.oid.slice(0, 7)}</code>
              {c.oid === git.headOid ? <span className="cv-badge cv-badge--accent">HEAD</span> : null}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ---------------- Settings ---------------- */
function Row({ label, desc, children }) {
  return (
    <div className="setting-row" style={{ padding: '6px 0' }}>
      <div className="setting-row__text"><div className="setting-row__label">{label}</div>{desc ? <div className="setting-row__desc">{desc}</div> : null}</div>
      {children}
    </div>
  );
}

function SettingsDialog({ data, onClose }) {
  const { settings, setSettings, currentUser, isAuthenticated, project, projectId, capabilities } = useWorkspace();
  const { signOut, signIn, openProfile } = useSession();
  const [tab, setTab] = useState(data.tab || 'editor');
  return (
    <Modal open title="Settings" onClose={onClose} size="lg" footer={<><Button variant="ghost" onClick={() => setSettings(DEFAULT_SETTINGS)}>Reset to defaults</Button><Button variant="primary" onClick={onClose}>Done</Button></>}>
      <div className="settings-tabs">
        {[['editor', 'Editor'], ['ai', 'AI'], ['workspace', 'Workspace'], ['account', 'Account']].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'editor' ? (
        <>
          <Row label="Theme" desc="Syntax colours for the editor.">
            <Select value={settings.theme} onChange={(e) => setSettings({ theme: e.target.value })}>{EDITOR_THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select>
          </Row>
          <Row label="Font size" desc="Editor and terminal text size in pixels.">
            <Input type="number" min={10} max={22} value={settings.fontSize} onChange={(e) => setSettings({ fontSize: Math.max(10, Math.min(22, Number(e.target.value) || 13)) })} style={{ width: 72 }} />
          </Row>
          <Row label="Tab size" desc="Number of spaces per indentation level.">
            <Select value={settings.tabSize} onChange={(e) => setSettings({ tabSize: Number(e.target.value) })} style={{ width: 90 }}>{[2, 4, 8].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
          </Row>
          <Row label="Line height"><Select value={settings.lineHeight} onChange={(e) => setSettings({ lineHeight: Number(e.target.value) })} style={{ width: 90 }}>{[1.4, 1.5, 1.6, 1.8].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Row>
          <Row label="Word wrap"><Switch checked={settings.wordWrap} onChange={(v) => setSettings({ wordWrap: v })} label="Word wrap" /></Row>
          <Row label="Minimap"><Switch checked={settings.minimap} onChange={(v) => setSettings({ minimap: v })} label="Minimap" /></Row>
          <Row label="Line numbers"><Switch checked={settings.lineNumbers} onChange={(v) => setSettings({ lineNumbers: v })} label="Line numbers" /></Row>
          <Row label="Font ligatures" desc="Combine character pairs like => and !== in JetBrains Mono."><Switch checked={settings.ligatures} onChange={(v) => setSettings({ ligatures: v })} label="Ligatures" /></Row>
          <Row label="Run Python in the browser" desc="Execute .py files locally with Pyodide (WebAssembly CPython) — no server, no rate limits; ~12 MB download on first run, then cached."><Switch checked={!!settings.pyInBrowser} onChange={(v) => setSettings({ pyInBrowser: v })} label="Run Python in the browser" /></Row>
        </>
      ) : null}
      {tab === 'ai' ? (
        <>
          <Row label="Inline suggestions" desc="Show ghost-text completions while typing (Tab to accept)."><Switch checked={settings.inlineAi} onChange={(v) => setSettings({ inlineAi: v })} label="Inline suggestions" /></Row>
          <Row label="Review edits as a diff" desc="Apply / Replace selection / Ctrl+I show AI changes inline with accept & reject per change instead of overwriting immediately."><Switch checked={settings.aiDiffPreview !== false} onChange={(v) => setSettings({ aiDiffPreview: v })} label="Review edits as a diff" /></Row>
          <Row label="Model" desc="Completions and chat run on Groq."><span className="cv-badge cv-badge--ai"><Sparkles style={{ width: 11, height: 11 }} /> {capabilities?.models?.chat || 'Groq default'}</span></Row>{capabilities?.models?.fast ? <Row label="Inline model" desc="Fast model used for ghost-text completions."><span className="cv-badge">{capabilities.models.fast}</span></Row> : null}
          <div className="sidebar__note">Context sent with each request: the active file (or your selection), its language and the latest problems. Nothing is sent when the assistant is idle.</div>
        </>
      ) : null}
      {tab === 'workspace' ? (
        <>
          <Row label="Auto save" desc="Save 1.5s after you stop typing."><Switch checked={settings.autoSave} onChange={(v) => setSettings({ autoSave: v })} label="Auto save" /></Row>
          <dl className="kv" style={{ padding: '4px 0' }}>
            <dt>Project</dt><dd>{project?.projectName}</dd>
            <dt>Project ID</dt><dd>{projectId}</dd>
            <dt>Storage</dt><dd>Codev cloud (S3)</dd>
            <dt>Runner</dt><dd>JDoodle · C++17, Java, Python 3, Node.js</dd>
          </dl>
        </>
      ) : null}
      {tab === 'account' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={currentUser.name} src={currentUser.avatar} size="xl" />
            <div><div style={{ fontWeight: 600 }}>{currentUser.name}</div><div className="u-muted" style={{ fontSize: 'var(--fs-xs)' }}>{isAuthenticated ? currentUser.email : 'Not signed in — you are editing as a guest.'}</div></div>
          </div>
          {isAuthenticated ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={openProfile}>Manage account</Button>
              <Button variant="ghost" icon={<LogOut />} onClick={() => signOut()}>Log out</Button>
            </div>
          ) : <Button variant="primary" onClick={() => signIn()} style={{ alignSelf: 'flex-start' }}>Log in</Button>}
        </div>
      ) : null}
    </Modal>
  );
}

/* ---------------- Shortcuts ---------------- */
function ShortcutsDialog({ onClose }) {
  const rows = [
    ['Command palette', SHORTCUTS.palette], ['Command palette (alt)', SHORTCUTS.paletteAlt], ['Go to file', SHORTCUTS.quickOpen], ['Go to line', SHORTCUTS.goToLine],
    ['Run code', SHORTCUTS.run], ['Save', SHORTCUTS.save], ['Save all', SHORTCUTS.saveAll], ['Close editor', SHORTCUTS.closeTab], ['New file', SHORTCUTS.newFile],
    ['Toggle sidebar', SHORTCUTS.sidebar], ['Toggle panel', SHORTCUTS.panel], ['Toggle terminal', SHORTCUTS.terminal], ['Problems', SHORTCUTS.problems],
    ['Explorer', SHORTCUTS.explorer], ['Search in project', SHORTCUTS.search], ['Source control', SHORTCUTS.scm], ['Collaboration', SHORTCUTS.collab],
    ['AI assistant', SHORTCUTS.ai], ['Inline AI edit', SHORTCUTS.inlineAi], ['Accept inline suggestion', 'Tab'], ['Dismiss suggestion', 'Escape'],
    ['Find in file', SHORTCUTS.find], ['Settings', SHORTCUTS.settings], ['Keyboard shortcuts', SHORTCUTS.shortcuts],
  ];
  return (
    <Modal open title="Keyboard shortcuts" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Close</Button>}>
      <div className="shortcuts">
        {rows.map(([label, combo]) => (
          <React.Fragment key={label}><span>{label}</span><Kbd keys={shortcutParts(combo)} /></React.Fragment>
        ))}
      </div>
    </Modal>
  );
}

export default function Dialogs() {
  const { dialog, closeDialog } = useWorkspace();
  if (!dialog) return null;
  const props = { data: dialog, onClose: closeDialog };
  switch (dialog.type) {
    case 'newFile': return <NewFileDialog {...props} />;
    case 'newFolder': return <NewFolderDialog {...props} />;
    case 'rename': return <RenameDialog {...props} />;
    case 'confirmDelete': return <ConfirmDeleteDialog {...props} />;
    case 'share': return <ShareDialog {...props} />;
    case 'history': return <HistoryDialog {...props} />;
    case 'settings': return <SettingsDialog {...props} />;
    case 'shortcuts': return <ShortcutsDialog {...props} />;
    default: return null;
  }
}

'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '../lib/nav';
import { useSession } from '../lib/session';
import { Plus, Search, FolderKanban, ArrowRight, Trash2, MoreHorizontal, LogOut, ExternalLink, AlertTriangle, RefreshCw, Keyboard, CornerDownLeft } from 'lucide-react';
import { Button, IconButton, Input, Logo, Avatar, Menu, useMenu, Modal, Field, Skeleton, EmptyState, useToast, Kbd } from '../ui';
import * as api from '../lib/api';
import { errorMessage } from '../lib/api';
import { fuzzyMatch } from '../lib/fuzzy';
import FileIcon from '../ide/FileIcon';
import { baseName } from '../lib/fileTypes';

function Highlight({ text, indices }) {
  if (!indices?.length) return text;
  const set = new Set(indices);
  return text.split('').map((ch, i) => (set.has(i) ? <mark key={i}>{ch}</mark> : ch));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, signIn, signOut } = useSession();
  const { toast } = useToast();
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const menu = useMenu();
  const userMenu = useMenu();
  const searchRef = useRef(null);

  useEffect(() => {
    document.body.classList.add('page-scroll');
    document.title = 'Projects · Codev';
    return () => document.body.classList.remove('page-scroll');
  }, []);

  const load = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    setError(null);
    try {
      const list = await api.listProjects();
      setProjects(list);
    } catch (e) {
      // A brand-new user has no record yet: the API answers 404 → treat as empty
      if (e?.response?.status === 404) setProjects([]);
      else setError(errorMessage(e, 'Could not load projects'));
    }
  }, [isAuthenticated, user]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!projects) return [];
    if (!query.trim()) return projects.map((p) => ({ p, m: { indices: [] } }));
    return projects.map((p) => ({ p, m: fuzzyMatch(query.trim(), p.projectName || '') })).filter((x) => x.m).sort((a, b) => b.m.score - a.m.score);
  }, [projects, query]);
  useEffect(() => { setActive(0); }, [query, projects]);

  const open = (p) => navigate(`/ide/${encodeURIComponent(p.projectId)}${p.files?.[0]?.fileName ? '/' + p.files[0].fileName.split('/').map(encodeURIComponent).join('/') : ''}`);

  const create = async () => {
    if (!name.trim() || busy) return;
    if (!isAuthenticated || !user) { toast({ kind: 'warn', title: 'Sign in to create a project' }); return; }
    setBusy(true);
    try {
      const p = await api.createProject({ projectName: name.trim() });
      setProjects((ps) => [...(ps || []), { ...p, files: [] }]);
      setCreating(false);
      setName('');
      toast({ kind: 'success', title: 'Project created', description: p.projectName, actions: [{ label: 'Open', onClick: () => open(p) }] });
    } catch (e) {
      toast({ kind: 'error', title: 'Could not create project', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    setBusy(true);
    try {
      await api.deleteProject(p.projectId);
      setProjects((ps) => ps.filter((x) => x.projectId !== p.projectId));
      setConfirm(null);
      toast({ kind: 'info', title: 'Project deleted', description: p.projectName });
    } catch (e) {
      toast({ kind: 'error', title: 'Delete failed', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  // Keyboard: / focuses search, ↑↓ navigate, Enter opens, N creates
  useEffect(() => {
    const onKey = (e) => {
      const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (e.key === '/' && !inInput) { e.preventDefault(); searchRef.current?.focus(); }
      else if ((e.key === 'n' || e.key === 'N') && !inInput && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setCreating(true); }
      else if (e.key === 'ArrowDown' && (inInput ? document.activeElement === searchRef.current : true)) { e.preventDefault(); setActive((a) => Math.min(filtered.length - 1, a + 1)); }
      else if (e.key === 'ArrowUp' && (inInput ? document.activeElement === searchRef.current : true)) { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      else if (e.key === 'Enter' && (!inInput || document.activeElement === searchRef.current) && filtered[active]) { e.preventDefault(); open(filtered[active].p); }
    };
    if (!creating && !confirm) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, active, creating, confirm]);

  const displayName = user?.name || user?.nickname || user?.email || 'Guest';

  return (
    <div className="page">
      <nav className="page__nav">
        <Logo />
        <span className="u-grow" />
        {isAuthenticated ? (
          <button type="button" className="topbar__avatar" onClick={(e) => userMenu.openAt(e.currentTarget)} aria-label="Account menu"><Avatar name={displayName} src={user?.picture} size="md" /></button>
        ) : (
          <Button variant="primary" size="sm" onClick={() => signIn()} loading={isLoading}>Sign in</Button>
        )}
        <Menu open={userMenu.open} anchor={userMenu.anchor} onClose={userMenu.close} align="end" minWidth={220} items={[{ title: user?.email || displayName }, { label: 'Log out', icon: <LogOut />, onSelect: () => signOut() }]} />
      </nav>

      <div className="page__body">
        {isLoading ? (
          <div className="dash__list">{[0, 1, 2].map((i) => <div key={i} className="dash__skeleton"><Skeleton width={30} height={30} /><Skeleton width="30%" height={10} /><Skeleton width="20%" height={9} /></div>)}</div>
        ) : !isAuthenticated ? (
          <div className="gate">
            <Logo word={false} size={36} />
            <h2>Sign in to see your projects</h2>
            <p>Codev keeps your projects in the cloud so you can open them from anywhere and share them with collaborators.</p>
            <Button variant="primary" size="lg" onClick={() => signIn()} style={{ marginTop: 10 }}>Sign in to continue</Button>
          </div>
        ) : (
          <>
            <div className="dash__head">
              <div>
                <div className="dash__title">Projects{projects ? <small>{projects.length} total</small> : null}</div>
                <div className="dash__sub">Welcome back, {displayName.split(' ')[0]}. Pick a workspace or start a new one.</div>
              </div>
              <div className="dash__tools">
                <Input ref={searchRef} icon={<Search />} placeholder="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 240 }} trailing={<Kbd keys={['/']} />} onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); e.target.blur(); } }} />
                <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>New project</Button>
              </div>
            </div>

            {error ? (
              <div className="notice notice--danger" style={{ marginBottom: 12 }}>
                <span className="notice__icon"><AlertTriangle /></span>
                <div style={{ flex: 1 }}><div className="notice__title">Couldn’t load projects</div><div className="notice__desc">{error}</div><div className="notice__actions"><Button size="sm" icon={<RefreshCw />} onClick={load}>Retry</Button></div></div>
              </div>
            ) : null}

            <div className="dash__list">
              {projects === null && !error ? (
                [0, 1, 2, 3].map((i) => <div key={i} className="dash__skeleton"><Skeleton width={30} height={30} /><Skeleton width={`${28 + i * 7}%`} height={10} /><Skeleton width="18%" height={9} /></div>)
              ) : filtered.length ? (
                filtered.map(({ p, m }, i) => (
                  <div key={p.projectId} role="button" tabIndex={0} className={`dash__row ${i === active ? 'is-active' : ''}`} onClick={() => open(p)} onKeyDown={(e) => { if (e.key === 'Enter') open(p); }} onPointerEnter={() => setActive(i)} onContextMenu={(e) => menu.openAt(e, p)}>
                    <span className="dash__row-icon"><FolderKanban /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="dash__name"><Highlight text={p.projectName || 'Untitled'} indices={m.indices} /></div>
                      <div className="dash__meta">{p.files?.length || 0} file{p.files?.length === 1 ? '' : 's'} · {p.projectId.slice(0, 8)}</div>
                    </div>
                    <div className="dash__files">
                      {(p.files || []).slice(0, 4).map((f) => <span key={f.fileName} className="cv-chip"><FileIcon name={f.fileName} size="sm" />{baseName(f.fileName)}</span>)}
                      {(p.files?.length || 0) > 4 ? <span className="more">+{p.files.length - 4}</span> : null}
                    </div>
                    <div className="dash__actions">
                      <Button size="sm" variant="ghost" iconRight={<ArrowRight />} onClick={(e) => { e.stopPropagation(); open(p); }}>Open</Button>
                      <IconButton size="sm" label="More" onClick={(e) => { e.stopPropagation(); menu.openAt(e.currentTarget, p); }}><MoreHorizontal /></IconButton>
                    </div>
                  </div>
                ))
              ) : projects && !projects.length ? (
                <div className="dash__empty">
                  <EmptyState icon={<FolderKanban />} title="No projects yet" description="Create your first project — you'll get an editor, a terminal and an AI assistant ready to go." actions={<Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>Create project</Button>} />
                </div>
              ) : (
                <div className="dash__empty"><EmptyState icon={<Search />} title={`No projects match “${query}”`} description="Try a different name." actions={<Button onClick={() => setQuery('')}>Clear search</Button>} /></div>
              )}
            </div>
            <div className="dash__hint">
              <span><Kbd keys={['↑', '↓']} /> navigate</span>
              <span><CornerDownLeft style={{ width: 11, height: 11 }} /> open</span>
              <span><Kbd keys={['N']} /> new project</span>
              <span><Kbd keys={['/']} /> search</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}><Keyboard style={{ width: 11, height: 11 }} /> Keyboard-first</span>
            </div>
          </>
        )}
      </div>

      <Menu open={menu.open} anchor={menu.anchor} onClose={menu.close} align="end" items={menu.data ? [
        { label: 'Open', icon: <ExternalLink />, onSelect: () => open(menu.data) },
        { label: 'Copy project ID', onSelect: () => { navigator.clipboard.writeText(menu.data.projectId); toast({ kind: 'info', title: 'Project ID copied', duration: 1500 }); } },
        { separator: true },
        { label: 'Delete project…', icon: <Trash2 />, danger: true, onSelect: () => setConfirm(menu.data) },
      ] : []} />

      <Modal open={creating} onClose={() => setCreating(false)} title="New project" size="sm" description="A project is a folder of files you can edit, run and share."
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button variant="primary" onClick={create} disabled={!name.trim()} loading={busy}>Create project</Button></>}>
        <Field label="Project name">
          <Input data-autofocus placeholder="e.g. graph-algorithms" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
        </Field>
      </Modal>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Delete project?" size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="danger-solid" onClick={() => remove(confirm)} loading={busy}>Delete</Button></>}>
        {confirm ? (
          <div className="notice notice--warn"><span className="notice__icon"><AlertTriangle /></span><div><div className="notice__title">{confirm.projectName}</div><div className="notice__desc">This permanently deletes the project and its {confirm.files?.length || 0} file{confirm.files?.length === 1 ? '' : 's'}. This cannot be undone.</div></div></div>
        ) : null}
      </Modal>
    </div>
  );
}

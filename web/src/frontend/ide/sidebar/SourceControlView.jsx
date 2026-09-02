'use client';
import React, { useState } from 'react';
import { GitBranch, Save, RotateCcw, History, Check, GitCommitHorizontal } from 'lucide-react';
import { Button, IconButton, SectionHeader, Textarea, EmptyState, useToast } from '../../ui';
import { useWorkspace } from '../WorkspaceContext';
import FileIcon from '../FileIcon';
import { baseName, dirName } from '../../lib/fileTypes';

/**
 * Source control: "Commit" saves every dirty file, then creates a real local git commit
 * (isomorphic-git, stored server-side — see src/backend/git.js). Purely local version history,
 * no remotes; "History" opens the commit log with diffs and revert.
 */
export default function SourceControlView() {
  const ws = useWorkspace();
  const { dirty, untracked, saveFile, saveAll, openFile, activeTab, files, git, committing, commitAll, openDialog, savedRef, editorRef, contentsRef, handleContentChange } = ws;
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const changes = Array.from(new Set([...dirty, ...untracked])).sort();

  const discard = (path) => {
    const saved = savedRef.current.get(path);
    if (saved === undefined) return;
    const ed = editorRef.current;
    if (ed && ed.file === path) ed.replaceAll(saved);
    else { contentsRef.current.set(path, saved); handleContentChange(path, saved); }
    toast({ kind: 'info', title: 'Changes discarded', description: baseName(path), duration: 1500 });
  };

  const commit = async () => {
    const res = await commitAll(message.trim());
    if (res?.committed) setMessage('');
  };

  return (
    <div className="sidebar__body">
      <div className="scm__commit">
        <Textarea
          rows={2}
          placeholder="Commit message (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') commit(); }}
          style={{ minHeight: 52 }}
        />
        <Button variant="primary" block icon={<Check />} disabled={committing || !files.length} onClick={commit} shortcut="Mod+Enter">
          {committing ? 'Committing…' : 'Commit'}
        </Button>
      </div>
      <div className="sidebar__section sidebar__section--grow">
        <SectionHeader
          title="Changes"
          badge={changes.length ? <span className="cv-badge cv-badge--count">{changes.length}</span> : null}
          actions={changes.length ? <IconButton size="sm" label="Save all" onClick={saveAll}><Save /></IconButton> : null}
        />
        {changes.length ? (
          <div className="sidebar__list">
            {changes.map((p) => (
              <div key={p} className="scm__file" onClick={() => openFile(p)} title={p}>
                <FileIcon name={p} size="sm" />
                <span className="u-truncate">{baseName(p)}</span>
                {dirName(p) ? <span className="path">{dirName(p)}</span> : null}
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                  {dirty.has(p) ? <IconButton size="sm" label="Discard changes" onClick={(e) => { e.stopPropagation(); discard(p); }}><RotateCcw /></IconButton> : null}
                  {dirty.has(p) ? <IconButton size="sm" label="Save" onClick={(e) => { e.stopPropagation(); saveFile(p); }}><Save /></IconButton> : null}
                  <span className={`tree__status ${dirty.has(p) ? 'tree__status--m' : 'tree__status--u'}`}>{dirty.has(p) ? 'M' : 'U'}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact icon={<GitCommitHorizontal />} title="Working tree clean" description="Edits you make will show up here until they are committed." />
        )}
      </div>
      <div className="sidebar__section">
        <SectionHeader title="History" actions={<IconButton size="sm" label="View history" onClick={() => openDialog('history')}><History /></IconButton>} />
        <button type="button" className="scm__file" style={{ width: '100%' }} onClick={() => openDialog('history')}>
          <GitCommitHorizontal style={{ width: 13, height: 13 }} />
          <span className="u-truncate">{git.headOid ? `at ${git.headOid.slice(0, 7)}` : 'No commits yet'}</span>
        </button>
      </div>
      <div className="sidebar__section">
        <SectionHeader title="Repository" />
        <dl className="kv">
          <dt>Branch</dt><dd><GitBranch style={{ width: 11, height: 11, verticalAlign: -1, marginRight: 4 }} />{git.branch}</dd>
          <dt>Remote</dt><dd className="u-muted">none — local history only</dd>
          <dt>Files</dt><dd>{files.length}</dd>
          <dt>HEAD</dt><dd>{git.headOid ? <code>{git.headOid.slice(0, 7)}</code> : '—'}</dd>
        </dl>
        <div className="sidebar__hint">
          Commits are saved on Codev&apos;s servers, not a remote — there&apos;s nothing to push or pull. Use History to browse past commits, view diffs, and revert.
        </div>
      </div>
    </div>
  );
}

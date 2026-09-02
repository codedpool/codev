// Real local git history per project — commits, log, diffs, revert. No remotes: this repo never
// pushes/pulls or talks to GitHub, it's purely local version control (like editor checkpoints).
//
// There is no persistent disk to keep a working .git directory on (serverless / Vercel), so each
// call rehydrates a minimal in-memory filesystem (memfs) from loose git objects stored in Mongo,
// runs the isomorphic-git operation, then writes back whatever new objects it created. Loose
// objects are content-addressed (sha1 of their own bytes) so this is safe to do repeatedly —
// re-writing an object that already exists is a no-op.
import git from 'isomorphic-git';
import { Volume, createFsFromVolume } from 'memfs';
import GitObject from './models/GitObject';
import { connectDB } from './db';

const DIR = '/repo';
const AUTHOR = { name: 'Codev', email: 'ai@codev.local' };

async function loadFs(projectId) {
  await connectDB();
  const vol = new Volume();
  const fs = createFsFromVolume(vol);
  fs.mkdirSync(`${DIR}/.git/objects`, { recursive: true });
  const objs = await GitObject.find({ projectId }).lean();
  for (const o of objs) {
    const dir = `${DIR}/.git/objects/${o.oid.slice(0, 2)}`;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/${o.oid.slice(2)}`, o.data.buffer ?? o.data);
  }
  return { fs, existingOids: new Set(objs.map((o) => o.oid)) };
}

/** Persist any loose objects isomorphic-git wrote that we don't already have in Mongo. */
async function saveNewObjects(fs, projectId, existingOids) {
  const objDir = `${DIR}/.git/objects`;
  if (!fs.existsSync(objDir)) return;
  const ops = [];
  for (const sub of fs.readdirSync(objDir)) {
    if (sub.length !== 2) continue; // skip pack/, info/
    for (const rest of fs.readdirSync(`${objDir}/${sub}`)) {
      const oid = sub + rest;
      if (existingOids.has(oid)) continue;
      const data = Buffer.from(fs.readFileSync(`${objDir}/${sub}/${rest}`));
      ops.push({ updateOne: { filter: { projectId, oid }, update: { $setOnInsert: { projectId, oid, data } }, upsert: true } });
    }
  }
  if (ops.length) await GitObject.bulkWrite(ops, { ordered: false });
}

async function ensureInit(fs, branch) {
  if (!fs.existsSync(`${DIR}/.git/config`)) {
    await git.init({ fs, dir: DIR, defaultBranch: branch });
  }
}

/** Write `files` (path -> content) into the in-memory working tree, removing anything not listed. */
function writeWorkingTree(fs, files) {
  const wanted = new Set(Object.keys(files));
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (name === '.git') continue;
      const p = `${dir}/${name}`;
      const rel = p.slice(DIR.length + 1);
      if (fs.statSync(p).isDirectory()) { walk(p); continue; }
      if (!wanted.has(rel)) fs.unlinkSync(p);
    }
  };
  walk(DIR);
  for (const [path, content] of Object.entries(files)) {
    const full = `${DIR}/${path}`;
    const dir = full.slice(0, full.lastIndexOf('/'));
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content ?? '');
  }
}

/**
 * Create a commit snapshotting `files` (path -> content, the project's current file list).
 * Returns { oid, changed: boolean } — changed is false when the tree is identical to HEAD (no-op commit skipped).
 */
export async function commitSnapshot({ projectId, branch = 'main', headOid, files, message, author }) {
  const { fs, existingOids } = await loadFs(projectId);
  await ensureInit(fs, branch);
  if (headOid) await git.writeRef({ fs, dir: DIR, ref: `refs/heads/${branch}`, value: headOid, force: true });

  writeWorkingTree(fs, files);
  await git.add({ fs, dir: DIR, filepath: '.' });
  // Stage deletions too — `add` only covers additions/modifications.
  const status = await git.statusMatrix({ fs, dir: DIR });
  for (const [filepath, , worktreeStatus] of status) {
    if (worktreeStatus === 0) await git.remove({ fs, dir: DIR, filepath });
  }

  const oid = await git.commit({
    fs,
    dir: DIR,
    ref: `refs/heads/${branch}`,
    message: message || 'Update files',
    author: { name: author?.name || AUTHOR.name, email: author?.email || AUTHOR.email, timestamp: Math.floor(Date.now() / 1000) },
  });

  // No-op guard: isomorphic-git still creates a commit even with an identical tree, unless there
  // truly were zero staged changes — statusMatrix above already tells us that up front.
  const changed = status.some(([, head, workdir, stage]) => head !== workdir || workdir !== stage);
  await saveNewObjects(fs, projectId, existingOids);
  return { oid, changed };
}

/** Commit log, newest first. */
export async function log({ projectId, branch = 'main', headOid, depth = 50 }) {
  if (!headOid) return [];
  const { fs } = await loadFs(projectId);
  await ensureInit(fs, branch);
  const commits = await git.log({ fs, dir: DIR, ref: headOid, depth });
  return commits.map((c) => ({
    oid: c.oid,
    message: c.commit.message,
    author: c.commit.author.name,
    email: c.commit.author.email,
    date: new Date(c.commit.author.timestamp * 1000).toISOString(),
    parent: c.commit.parent?.[0] || null,
  }));
}

/** Full file list at a given commit: path -> content. */
async function treeFiles(fs, oid) {
  if (!oid) return {};
  const files = {};
  const walk = async (treeOid, prefix) => {
    const { tree } = await git.readTree({ fs, dir: DIR, oid: treeOid });
    for (const entry of tree) {
      const path = prefix ? `${prefix}/${entry.path}` : entry.path;
      if (entry.type === 'tree') await walk(entry.oid, path);
      else {
        const { blob } = await git.readBlob({ fs, dir: DIR, oid: entry.oid });
        files[path] = Buffer.from(blob).toString('utf-8');
      }
    }
  };
  const { commit } = await git.readCommit({ fs, dir: DIR, oid });
  await walk(commit.tree, '');
  return files;
}

/** Per-file diff between two commits (or a commit and the empty tree, for the first commit). */
export async function diffCommit({ projectId, oid }) {
  const { fs } = await loadFs(projectId);
  const { commit } = await git.readCommit({ fs, dir: DIR, oid });
  const parentOid = commit.parent?.[0] || null;
  const [before, after] = await Promise.all([treeFiles(fs, parentOid), treeFiles(fs, oid)]);
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  const files = [];
  for (const path of paths) {
    const a = before[path];
    const b = after[path];
    if (a === b) continue;
    files.push({ path, status: a === undefined ? 'added' : b === undefined ? 'deleted' : 'modified', before: a ?? '', after: b ?? '' });
  }
  return { oid, parentOid, files: files.sort((x, y) => x.path.localeCompare(y.path)) };
}

/** Every file's content at a commit — used to revert the project to that point. */
export async function filesAtCommit({ projectId, oid }) {
  const { fs } = await loadFs(projectId);
  return treeFiles(fs, oid);
}

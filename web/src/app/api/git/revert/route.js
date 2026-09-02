import { handler, json, readJson, HttpError } from '@/backend/http';
import { requireUser, requireProject } from '@/backend/auth';
import { putFile, deleteFile, isNotFound } from '@/backend/s3';
import { filesAtCommit, commitSnapshot } from '@/backend/git';
import { rateLimit } from '@/backend/ratelimit';

// POST /api/git/revert { projectId, oid } — reset every file to its state at `oid`, recorded as a new commit.
export const POST = handler(async (req) => {
  const { user } = await requireUser();
  rateLimit(`git:revert:${user._id}`, { limit: 15, windowMs: 60_000 });
  const { projectId, oid } = await readJson(req);
  if (!projectId || !/^[0-9a-f]{40}$/.test(oid || '')) throw new HttpError(400, 'Project ID and a valid commit id are required');
  const project = await requireProject(projectId, user);
  if (!project.git?.headOid) throw new HttpError(400, 'This project has no commit history yet');

  const targetFiles = await filesAtCommit({ projectId, oid });
  const currentPaths = new Set(project.files.map((f) => f.fileName));
  const targetPaths = new Set(Object.keys(targetFiles));

  await Promise.all([
    ...Object.entries(targetFiles).map(([path, content]) => putFile(projectId, path, content)),
    ...[...currentPaths].filter((p) => !targetPaths.has(p)).map((p) => deleteFile(projectId, p).catch((e) => { if (!isNotFound(e)) throw e; })),
  ]);

  project.files = [...targetPaths].map((fileName) => ({ fileName }));

  const branch = project.git.branch || 'main';
  const { oid: newOid } = await commitSnapshot({
    projectId,
    branch,
    headOid: project.git.headOid,
    files: targetFiles,
    message: `Revert to ${oid.slice(0, 7)}`,
    author: { name: user.name, email: user.email },
  });
  project.git.headOid = newOid;
  await project.save();

  // Return the new content too: the client must push it into any open editors (including live
  // collaboration documents) explicitly — a client that already has the file open won't otherwise
  // know its Yjs document is now stale relative to storage.
  return json({ reverted: true, oid: newOid, files: [...targetPaths], contents: targetFiles });
});

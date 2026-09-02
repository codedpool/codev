import { handler, json, readJson, assertFilePath, HttpError } from '@/backend/http';
import { requireUser, requireProject } from '@/backend/auth';
import { copyFile, deleteFile, isNotFound } from '@/backend/s3';

// POST /api/files/rename { projectId, from, to }
// Renames/moves a file, or a whole folder when `from` and `to` end with "/".
export const POST = handler(async (req) => {
  const { user } = await requireUser();
  const { projectId, from, to } = await readJson(req);
  if (!projectId) throw new HttpError(400, 'Project ID is required');
  const project = await requireProject(projectId, user);
  const isDir = typeof from === 'string' && from.endsWith('/');
  const src = assertFilePath(isDir ? from.slice(0, -1) : from);
  const dst = assertFilePath(isDir ? String(to).replace(/\/$/, '') : to);
  const files = project.files.map((f) => f.fileName);
  const moves = isDir ? files.filter((f) => f.startsWith(src + '/')).map((f) => [f, dst + f.slice(src.length)]) : [[src, dst]];
  if (!moves.length) throw new HttpError(404, 'File not found!');
  for (const [, t] of moves) {
    if (files.includes(t) && !moves.some(([s]) => s === t)) throw new HttpError(409, `${t} already exists`);
  }
  for (const [s, t] of moves) {
    if (s === t) continue;
    try {
      await copyFile(projectId, s, t);
      await deleteFile(projectId, s);
    } catch (e) {
      if (isNotFound(e)) throw new HttpError(404, `${s} not found`);
      throw e;
    }
  }
  const map = new Map(moves);
  project.files = project.files.map((f) => (map.has(f.fileName) ? { fileName: map.get(f.fileName) } : f));
  await project.save();
  return json({ moved: moves.map(([s, t]) => ({ from: s, to: t })) });
});

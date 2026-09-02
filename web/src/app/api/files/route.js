import { handler, json, readJson, assertFilePath, HttpError } from '@/backend/http';
import { requireUser, requireProject } from '@/backend/auth';
import { putFile } from '@/backend/s3';

const MAX_BYTES = 2 * 1024 * 1024;

// POST /api/files { projectId, fileName, content } — create or save (upsert)
export const POST = handler(async (req) => {
  const { user } = await requireUser();
  const { projectId, fileName, content = '' } = await readJson(req);
  if (!projectId) throw new HttpError(400, 'Project ID and file name are required!');
  const path = assertFilePath(fileName);
  if (typeof content !== 'string') throw new HttpError(400, 'Content must be a string');
  if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) throw new HttpError(413, 'File is too large (max 2 MB)');
  const project = await requireProject(projectId, user);
  await putFile(projectId, path, content);
  if (!project.files.some((f) => f.fileName === path)) {
    project.files.push({ fileName: path });
    await project.save();
  }
  return json({ message: 'File created successfully!', fileName: path }, { status: 201 });
});

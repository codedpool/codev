import { handler, json, assertFilePath, HttpError } from '@/backend/http';
import { requireUser, requireProject } from '@/backend/auth';
import { getFile, deleteFile, isNotFound } from '@/backend/s3';

const filePath = async (params) => {
  const { projectId, file } = await params;
  return { projectId, fileName: assertFilePath((file || []).map(decodeURIComponent).join('/')) };
};

// GET /api/files/:projectId/:path* -> { content }
export const GET = handler(async (_req, { params }) => {
  const { user } = await requireUser();
  const { projectId, fileName } = await filePath(params);
  await requireProject(projectId, user);
  try {
    const content = await getFile(projectId, fileName);
    return json({ content });
  } catch (e) {
    if (isNotFound(e)) throw new HttpError(404, 'File not found!');
    throw e;
  }
});

// DELETE /api/files/:projectId/:path*
export const DELETE = handler(async (_req, { params }) => {
  const { user } = await requireUser();
  const { projectId, fileName } = await filePath(params);
  const project = await requireProject(projectId, user);
  await deleteFile(projectId, fileName);
  project.files = project.files.filter((f) => f.fileName !== fileName);
  await project.save();
  return json({ message: 'File deleted successfully!' });
});

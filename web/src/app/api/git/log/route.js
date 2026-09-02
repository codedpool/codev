import { handler, json, HttpError } from '@/backend/http';
import { requireUser, requireProject } from '@/backend/auth';
import { log } from '@/backend/git';

// GET /api/git/log?projectId=... — commit history, newest first.
export const GET = handler(async (req) => {
  const { user } = await requireUser();
  const projectId = new URL(req.url).searchParams.get('projectId');
  if (!projectId) throw new HttpError(400, 'Project ID is required');
  const project = await requireProject(projectId, user);
  const commits = await log({ projectId, branch: project.git?.branch || 'main', headOid: project.git?.headOid || null });
  return json({ branch: project.git?.branch || 'main', commits });
});

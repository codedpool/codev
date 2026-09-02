import { handler, json, HttpError } from '@/backend/http';
import { requireUser, requireProject } from '@/backend/auth';
import { diffCommit } from '@/backend/git';

const OID_RE = /^[0-9a-f]{40}$/;

// GET /api/git/diff/:oid?projectId=... — per-file diff for one commit.
export const GET = handler(async (req, { params }) => {
  const { user } = await requireUser();
  const { oid } = await params;
  if (!OID_RE.test(oid)) throw new HttpError(400, 'Invalid commit id');
  const projectId = new URL(req.url).searchParams.get('projectId');
  if (!projectId) throw new HttpError(400, 'Project ID is required');
  await requireProject(projectId, user);
  const diff = await diffCommit({ projectId, oid });
  return json(diff);
});

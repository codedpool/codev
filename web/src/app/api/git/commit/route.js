import { handler, json, readJson, HttpError } from '@/backend/http';
import { requireUser, requireProject } from '@/backend/auth';
import { getFile, isNotFound } from '@/backend/s3';
import { commitSnapshot } from '@/backend/git';
import { rateLimit } from '@/backend/ratelimit';

// POST /api/git/commit { projectId, message? } — snapshot every current file as one commit.
export const POST = handler(async (req) => {
  const { user } = await requireUser();
  rateLimit(`git:commit:${user._id}`, { limit: 30, windowMs: 60_000 });
  const { projectId, message } = await readJson(req);
  if (!projectId) throw new HttpError(400, 'Project ID is required');
  const project = await requireProject(projectId, user);
  if (!project.files.length) throw new HttpError(400, 'Nothing to commit — this project has no files');

  const files = {};
  await Promise.all(
    project.files.map(async ({ fileName }) => {
      try {
        files[fileName] = await getFile(projectId, fileName);
      } catch (e) {
        if (!isNotFound(e)) throw e;
      }
    })
  );

  const branch = project.git?.branch || 'main';
  const { oid, changed } = await commitSnapshot({
    projectId,
    branch,
    headOid: project.git?.headOid || null,
    files,
    message,
    author: { name: user.name, email: user.email },
  });
  if (!changed) return json({ committed: false, message: 'Nothing to commit — working tree matches the last commit' });

  project.git = { branch, headOid: oid };
  await project.save();
  return json({ committed: true, oid, branch }, { status: 201 });
});

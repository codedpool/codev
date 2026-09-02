import { handler, json, readJson, assertFilePath, HttpError } from '@/backend/http';
import { requireUser, requireProject } from '@/backend/auth';
import { getFile, isNotFound } from '@/backend/s3';
import { runCode } from '@/backend/runner';
import { rateLimit } from '@/backend/ratelimit';

// POST /api/run { projectId, fileName, input } → { output }
// Reads the saved file from storage (the client saves before running), executes it, returns stdout/stderr.
export const POST = handler(async (req) => {
  const { user } = await requireUser();
  rateLimit(`run:${user._id}`, { limit: 30, windowMs: 60_000 });
  const { projectId, fileName, input = '' } = await readJson(req);
  if (!projectId) throw new HttpError(400, 'Project ID and file name are required!');
  const path = assertFilePath(fileName);
  await requireProject(projectId, user);
  let code;
  try {
    code = await getFile(projectId, path);
  } catch (e) {
    if (isNotFound(e)) throw new HttpError(404, 'File not found — save it before running');
    throw e;
  }
  const result = await runCode({ fileName: path, code, stdin: String(input || '') });
  return json(result);
});

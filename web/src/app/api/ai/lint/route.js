import { handler, json, readJson } from '@/backend/http';
import { requireUser } from '@/backend/auth';
import { rateLimit } from '@/backend/ratelimit';
import { lint } from '@/backend/ai';

export const POST = handler(async (req) => {
  const { user } = await requireUser();
  rateLimit(`ai:misc:${user._id}`, { limit: 20, windowMs: 60_000 });
  const { code } = await readJson(req);
  return json({ fixes: await lint(String(code || '')) });
});

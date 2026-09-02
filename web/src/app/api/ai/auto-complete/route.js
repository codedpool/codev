import { handler, json, readJson } from '@/backend/http';
import { requireUser } from '@/backend/auth';
import { rateLimit } from '@/backend/ratelimit';
import { inlineComplete } from '@/backend/ai';

// POST /api/ai/auto-complete { prefix, suffix, language, fileName } → { suggestions }
export const POST = handler(async (req) => {
  const { user } = await requireUser();
  rateLimit(`ai:complete:${user._id}`, { limit: 40, windowMs: 60_000 });
  const body = await readJson(req);
  try {
    const suggestions = await inlineComplete({ prefix: body.prefix ?? body.code, suffix: body.suffix, language: body.language, fileName: body.fileName });
    return json({ suggestions });
  } catch (e) {
    if (e?.status === 429) return json({ suggestions: '' }); // stay silent when rate-limited
    throw e;
  }
});

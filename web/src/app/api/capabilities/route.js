import { handler, json } from '@/backend/http';
import { requireUser } from '@/backend/auth';
import { runnerInfo } from '@/backend/runner';
import { MODELS } from '@/backend/groq';
import { GEMINI_MODELS, geminiEnabled } from '@/backend/gemini';

/** What this deployment can do — the client adapts (runnable languages, AI availability, collab). */
export const GET = handler(async () => {
  await requireUser();
  const runner = runnerInfo();
  const hasGroq = !!process.env.GROQ_API_KEY;
  return json({
    runner: runner.kind,
    languages: runner.languages,
    ai: hasGroq || geminiEnabled(),
    // The models actually used: Groq is primary, Gemini takes over only if Groq fails.
    models: hasGroq
      ? { chat: MODELS.chat, fast: MODELS.fast, fallback: geminiEnabled() ? GEMINI_MODELS.chat : null }
      : { chat: GEMINI_MODELS.chat, fast: GEMINI_MODELS.fast, fallback: null },
    collab: !!process.env.NEXT_PUBLIC_COLLAB_URL,
  });
});

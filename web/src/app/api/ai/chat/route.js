import { handler, readJson, error } from '@/backend/http';
import { requireUser } from '@/backend/auth';
import { rateLimit } from '@/backend/ratelimit';
import { chatStream } from '@/backend/ai';

export const maxDuration = 60;

// POST /api/ai/chat { messages, context } → text/plain stream
export const POST = handler(async (req) => {
  const { user } = await requireUser();
  rateLimit(`ai:chat:${user._id}`, { limit: 20, windowMs: 60_000 });
  const { messages, context } = await readJson(req);
  const encoder = new TextEncoder();
  let iterator;
  try {
    iterator = chatStream({ messages, context });
    // Kick off the request now so auth/limit errors surface as JSON before we commit to a stream.
    const first = await iterator.next();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (!first.done) controller.enqueue(encoder.encode(first.value));
          for await (const token of iterator) controller.enqueue(encoder.encode(token));
        } catch (e) {
          controller.enqueue(encoder.encode('\n\n[The assistant stopped unexpectedly. Please try again.]'));
          console.error('[ai/chat]', e);
        } finally {
          controller.close();
        }
      },
      cancel() { iterator.return?.(); },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
  } catch (e) {
    if (e?.status === 429) return error('The AI is rate-limited right now — try again in a moment.', 429);
    throw e;
  }
});

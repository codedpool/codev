// Google Gemini provider — the fallback used when Groq fails (quota, outage, model retired).
// Talks the REST API directly (no SDK) and exposes the same shapes ai.js expects from Groq.
// Enabled by setting GEMINI_API_KEY (https://aistudio.google.com/apikey).

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

export const GEMINI_MODELS = {
  chat: process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash',
  fast: process.env.GEMINI_FAST_MODEL || 'gemini-3.5-flash-lite',
};

export const geminiEnabled = () => !!process.env.GEMINI_API_KEY;

/** Gemini takes the system prompt separately and uses "model" instead of "assistant". */
function toGeminiBody({ system, messages, temperature, maxOutputTokens, thinking = 'low', stop }) {
  const body = {
    contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: {
      temperature,
      maxOutputTokens,
      // Gemini 3.x "thinks" by default, which adds seconds of latency; keep it minimal for editor use.
      thinkingConfig: { thinkingLevel: thinking },
      ...(stop?.length ? { stopSequences: stop.slice(0, 5) } : {}),
    },
  };
  if (system) body.system_instruction = { parts: [{ text: system }] };
  return body;
}

async function call(model, body, { stream = false, signal } = {}) {
  const method = stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
  const res = await fetch(`${API}/${model}:${method}key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const e = new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
    e.status = res.status;
    throw e;
  }
  return res;
}

const textOf = (data) =>
  (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text).filter(Boolean).join('') || '';

/** Non-streaming completion → string. */
export async function geminiComplete({ model, system, messages, temperature = 0.3, maxOutputTokens = 1000, thinking = 'low', stop, signal }) {
  const res = await call(model, toGeminiBody({ system, messages, temperature, maxOutputTokens, thinking, stop }), { signal });
  return textOf(await res.json());
}

/** Streaming completion → async iterator of text chunks (server-sent events). */
export async function* geminiStream({ model, system, messages, temperature = 0.4, maxOutputTokens = 1500, thinking = 'low', signal }) {
  const res = await call(model, toGeminiBody({ system, messages, temperature, maxOutputTokens, thinking }), { stream: true, signal });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const emit = () => {
    // SSE frames are separated by a blank line. Gemini sends CRLF, so accept both line endings.
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? '';
    const out = [];
    for (const frame of frames) {
      const line = frame.split(/\r?\n/).find((l) => l.startsWith('data:'));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const text = textOf(JSON.parse(payload));
        if (text) out.push(text);
      } catch { /* partial frame — wait for more bytes */ }
    }
    return out;
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    yield* emit();
  }
  // The last frame has no trailing "\n\n" before the stream closes — flush whatever remains.
  buffer += decoder.decode();
  yield* emit();
}

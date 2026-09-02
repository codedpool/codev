// AI gateway: chat/edits (streaming), FIM-style inline completions, and the legacy helpers.
// Primary provider is Groq; when it fails (quota, outage, retired model) and GEMINI_API_KEY is set,
// the same request is retried on Google Gemini. See shouldFallback() for what counts as "failed".
import { groq, MODELS, reasoningOpts } from './groq';
import { GEMINI_MODELS, geminiComplete, geminiStream, geminiEnabled } from './gemini';
import { HttpError } from './http';

const MAX_CONTEXT = 30_000;

/**
 * Retry on Gemini for infrastructure failures — quota/rate limit (429), server errors (5xx),
 * auth/model problems (401/403/404), and network errors (no status). A 400 means our own
 * request was malformed, so retrying it verbatim elsewhere would fail the same way.
 */
function shouldFallback(err) {
  if (!geminiEnabled()) return false;
  const status = err?.status ?? err?.response?.status;
  if (status == null) return true; // network / DNS / abort-less timeout
  if (status === 503 && !process.env.GROQ_API_KEY) return true; // Groq not configured — Gemini alone is fine
  return status === 429 || status === 401 || status === 403 || status === 404 || status >= 500;
}

function logFallback(where, err) {
  console.warn(`[ai] Groq failed in ${where} (${err?.status ?? 'network'}: ${String(err?.message).slice(0, 160)}) — falling back to Gemini`);
}

export function buildSystemPrompt(context = {}) {
  const parts = [
    'You are Codev AI, an expert pair programmer embedded in a browser code editor.',
    'Be concise and practical. Use markdown; put code in fenced blocks tagged with the language so the editor can offer "Apply" and "Insert" actions.',
    "When you return a modified version of the user's code, return the complete code for the file or selection in ONE fenced block.",
  ];
  if (context.mode === 'code-only') parts.push('Return ONLY a single fenced code block with the code. No prose before or after.');
  if (context.fileName) parts.push(`The user is working on the file "${context.fileName}"${context.language ? ` (${context.language})` : ''}.`);
  if (context.code) {
    const scope = context.isSelection
      ? `the user's current selection${context.selectionLines ? ` (lines ${context.selectionLines.from}-${context.selectionLines.to})` : ''}`
      : 'the full contents of the file';
    parts.push(`Here is ${scope}${context.truncated ? ' (truncated)' : ''}:\n\n\`\`\`${context.ext || ''}\n${String(context.code).slice(0, MAX_CONTEXT)}\n\`\`\``);
  }
  if (Array.isArray(context.problems) && context.problems.length) {
    parts.push(`Recent problems reported by the runner:\n${context.problems.map((p) => `- ${p}`).join('\n')}`);
  }
  return parts.join('\n\n');
}

const INLINE_SYSTEM =
  'You are an inline code completion engine inside a code editor. You receive the code before the cursor and after it. ' +
  'Reply with ONLY the raw code to insert at the cursor: no explanations, no markdown fences, do not repeat code already before the cursor, ' +
  'do not repeat code that comes after the cursor. Prefer short completions (one to a few lines) that finish the current statement or block. ' +
  'If the cursor is at the end of a line that opens a block (e.g. ends with ":" or "{"), start your completion with a newline and the correct indentation. ' +
  'If nothing sensible can be suggested, reply with an empty string.';

/**
 * Streaming chat completion → async iterator of text chunks.
 * The first Groq chunk is awaited before anything is yielded, so a failure can still fall back to
 * Gemini cleanly; once tokens have reached the client we never switch providers mid-answer.
 */
export async function* chatStream({ messages, context }) {
  const safe = (messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 20_000) }));
  if (!safe.length) throw new HttpError(400, 'messages are required');
  const system = buildSystemPrompt(context);
  const temperature = context?.mode === 'code-only' ? 0.2 : 0.4;

  let iterator = null;
  let first = null;
  try {
    const stream = await groq().chat.completions.create({
      model: MODELS.chat,
      messages: [{ role: 'system', content: system }, ...safe],
      temperature,
      max_tokens: 1500,
      ...reasoningOpts(MODELS.chat, 'low'),
      stream: true,
    });
    iterator = stream[Symbol.asyncIterator]();
    first = await iterator.next(); // may throw before any token is emitted
  } catch (e) {
    if (!shouldFallback(e)) throw e;
    logFallback('chatStream', e);
    yield* geminiStream({ model: GEMINI_MODELS.chat, system, messages: safe, temperature, maxOutputTokens: 1500 });
    return;
  }

  if (!first.done) {
    const token = first.value?.choices?.[0]?.delta?.content;
    if (token) yield token;
  }
  while (true) {
    const { value, done } = await iterator.next();
    if (done) break;
    const token = value?.choices?.[0]?.delta?.content;
    if (token) yield token;
  }
}

/**
 * Inline (ghost-text) completion. FIM-style prompt on the fast model: only the code to insert
 * at the cursor, short, no fences. Prefix/suffix windows are trimmed to keep latency low.
 */
export async function inlineComplete({ prefix, suffix = '', language, fileName }) {
  const before = String(prefix || '').slice(-2500);
  const after = String(suffix || '').slice(0, 600);
  if (!before.trim()) return '';
  const user =
    `${language ? `Language: ${language}\n` : ''}${fileName ? `File: ${fileName}\n` : ''}` +
    `<code_before_cursor>\n${before}\n</code_before_cursor>\n` +
    (after ? `<code_after_cursor>\n${after}\n</code_after_cursor>\n` : '') +
    'Completion:';
  const stop = ['</code_before_cursor>', '<code_after_cursor>', '```'];
  try {
    const res = await groq().chat.completions.create({
      model: MODELS.fast,
      messages: [{ role: 'system', content: INLINE_SYSTEM }, { role: 'user', content: user }],
      temperature: 0.2,
      max_tokens: 96,
      ...reasoningOpts(MODELS.fast, 'low'),
      stop,
    });
    return res.choices?.[0]?.message?.content ?? '';
  } catch (e) {
    if (!shouldFallback(e)) throw e;
    logFallback('inlineComplete', e);
    return geminiComplete({
      model: GEMINI_MODELS.fast,
      system: INLINE_SYSTEM,
      messages: [{ role: 'user', content: user }],
      temperature: 0.2,
      maxOutputTokens: 96,
      stop,
    });
  }
}

const SIMPLE_SYSTEM = 'You are a helpful code assistant.';

async function simple(userContent, { temperature = 0.3, max_tokens = 300 } = {}) {
  try {
    const res = await groq().chat.completions.create({
      model: MODELS.chat,
      messages: [{ role: 'system', content: SIMPLE_SYSTEM }, { role: 'user', content: userContent }],
      temperature,
      max_tokens,
      ...reasoningOpts(MODELS.chat, 'low'),
    });
    return res.choices?.[0]?.message?.content ?? '';
  } catch (e) {
    if (!shouldFallback(e)) throw e;
    logFallback('simple', e);
    return geminiComplete({
      model: GEMINI_MODELS.chat,
      system: SIMPLE_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      temperature,
      maxOutputTokens: max_tokens,
    });
  }
}
export const lint = (code) => simple(`Analyze this code for syntax errors and bugs and suggest fixes:\n${code}`, { temperature: 0.1, max_tokens: 400 });
export const generateDocs = (code) => simple(`Generate documentation for this code:\n${code}`, { temperature: 0.3, max_tokens: 500 });
export const generateSnippet = (description) => simple(`Generate a code snippet for: ${description}`, { temperature: 0.5, max_tokens: 400 });

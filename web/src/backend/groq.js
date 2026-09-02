import Groq from 'groq-sdk';

let client;
export function groq() {
  if (!process.env.GROQ_API_KEY) {
    const e = new Error('GROQ_API_KEY is not configured');
    e.status = 503;
    e.publicMessage = 'AI is not configured on this server (missing GROQ_API_KEY)';
    throw e;
  }
  client ||= new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

export const MODELS = {
  chat: process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b',
  fast: process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b',
};

/** Extra request params for reasoning models (gpt-oss, qwen3): keep latency low for inline completions. */
export function reasoningOpts(model, effort = 'low') {
  return /gpt-oss|qwen3|deepseek-r1|compound/.test(model) ? { reasoning_effort: effort } : {};
}

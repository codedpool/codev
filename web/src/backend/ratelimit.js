// Small in-memory sliding-window rate limiter (per user, per bucket). Fine for one instance;
// swap for Redis when scaling out.
import { HttpError } from './http';

const g = globalThis;
g.__codevRate ||= new Map();

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const arr = (g.__codevRate.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    const retry = Math.ceil((windowMs - (now - arr[0])) / 1000);
    throw new HttpError(429, `Too many requests. Try again in ${retry}s`);
  }
  arr.push(now);
  g.__codevRate.set(key, arr);
  if (g.__codevRate.size > 5000) {
    for (const [k, v] of g.__codevRate) if (!v.length || now - v[v.length - 1] > windowMs) g.__codevRate.delete(k);
  }
}

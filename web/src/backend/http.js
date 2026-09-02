import { NextResponse } from 'next/server';

export const json = (data, init) => NextResponse.json(data, init);
export const error = (message, status = 400, extra) => NextResponse.json({ error: message, ...extra }, { status });

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.publicMessage = message;
  }
}

/** Wrap a route handler: converts thrown errors (with optional .status) into JSON responses. */
export const handler = (fn) => async (req, ctx) => {
  try {
    return await fn(req, ctx);
  } catch (e) {
    const status = e?.status || 500;
    if (status >= 500) console.error('[api]', e);
    return error(e?.publicMessage || (status < 500 ? e.message : 'Internal server error'), status);
  }
};

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

/** Validate a project-relative file path: no traversal, no leading slash, sane length. */
export function assertFilePath(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) throw new HttpError(400, 'File name is required');
  const clean = fileName.replace(/\\/g, '/').trim();
  if (clean.length > 512 || clean.startsWith('/') || clean.split('/').some((p) => p === '' || p === '.' || p === '..')) {
    throw new HttpError(400, 'Invalid file path');
  }
  return clean;
}

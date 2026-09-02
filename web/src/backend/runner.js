// Code execution backends.
//   piston  — https://github.com/engineer-man/piston, self-hosted via PISTON_URL (see runner/README.md).
//   judge0  — JUDGE0_URL (https://ce.judge0.com public, or self-hosted) or JUDGE0_RAPIDAPI_KEY. ~40 languages, sandboxed.
//   jdoodle — set JDOODLE_CLIENT_ID/SECRET. The original 4 languages.
//   local   — host toolchains (python, node, gcc, ...). No sandbox: development / single-user only.
// Pick explicitly with RUNNER=piston|judge0|jdoodle|local|none, otherwise:
//   judge0 if configured → jdoodle if configured → piston if PISTON_URL → local (only outside production) → none.
import { HttpError } from './http';
import { localLanguages, runLocal } from './runners/local';
import { JUDGE0_LANGS, runJudge0 } from './runners/judge0';

// NOTE: the public instance (emkc.org) has been whitelist-only since Feb 2026 — self-host it (see runner/README.md).
const PISTON_PUBLIC = 'https://emkc.org/api/v2/piston';

// ext -> [piston language name, label]
const PISTON = {
  py: ['python', 'Python 3'], js: ['javascript', 'JavaScript (Node)'], ts: ['typescript', 'TypeScript'], cpp: ['c++', 'C++ (GCC)'], cc: ['c++', 'C++ (GCC)'],
  c: ['c', 'C (GCC)'], java: ['java', 'Java'], go: ['go', 'Go'], rs: ['rust', 'Rust'], rb: ['ruby', 'Ruby'], php: ['php', 'PHP'], cs: ['csharp.net', 'C# (.NET)'],
  kt: ['kotlin', 'Kotlin'], swift: ['swift', 'Swift'], sh: ['bash', 'Bash'], sql: ['sqlite3', 'SQL (SQLite)'], r: ['rscript', 'R'], scala: ['scala', 'Scala'],
  lua: ['lua', 'Lua'], pl: ['perl', 'Perl'], hs: ['haskell', 'Haskell'], dart: ['dart', 'Dart'], jl: ['julia', 'Julia'], ex: ['elixir', 'Elixir'], exs: ['elixir', 'Elixir'],
  clj: ['clojure', 'Clojure'], ml: ['ocaml', 'OCaml'], zig: ['zig', 'Zig'], nim: ['nim', 'Nim'], ps1: ['powershell', 'PowerShell'], pas: ['pascal', 'Pascal'],
  f90: ['fortran', 'Fortran'], groovy: ['groovy', 'Groovy'], cr: ['crystal', 'Crystal'], d: ['d', 'D'], erl: ['erlang', 'Erlang'], m: ['octave', 'Octave'],
  v: ['vlang', 'V'], rkt: ['racket', 'Racket'], lisp: ['lisp', 'Common Lisp'], fs: ['fsharp.net', 'F#'], cob: ['cobol', 'COBOL'], pro: ['prolog', 'Prolog'],
};

const JDOODLE = { cpp: 'cpp17', java: 'java', py: 'python3', js: 'nodejs' };

const RUN_TIMEOUT_MS = Number(process.env.RUN_TIMEOUT_MS || 5000);

export function runnerKind() {
  const forced = (process.env.RUNNER || '').toLowerCase();
  if (forced === 'none') return 'none';
  if (forced === 'judge0' && (process.env.JUDGE0_URL || process.env.JUDGE0_RAPIDAPI_KEY)) return 'judge0';
  if (forced === 'jdoodle' && process.env.JDOODLE_CLIENT_ID && process.env.JDOODLE_CLIENT_SECRET) return 'jdoodle';
  if (forced === 'piston') return 'piston';
  if (forced === 'local') return 'local';
  if (process.env.JUDGE0_URL || process.env.JUDGE0_RAPIDAPI_KEY) return 'judge0';
  if (process.env.JDOODLE_CLIENT_ID && process.env.JDOODLE_CLIENT_SECRET) return 'jdoodle';
  if (process.env.PISTON_URL) return 'piston';
  if (process.env.NODE_ENV !== 'production' && localLanguages().length) return 'local';
  return 'none';
}

export function runnerInfo() {
  const kind = runnerKind();
  if (kind === 'piston') return { kind, languages: Object.keys(PISTON) };
  if (kind === 'judge0') return { kind, languages: Object.keys(JUDGE0_LANGS) };
  if (kind === 'jdoodle') return { kind, languages: Object.keys(JDOODLE) };
  if (kind === 'local') return { kind, languages: localLanguages() };
  return { kind: 'none', languages: [] };
}

const extOf = (name) => (name.split('/').pop() || '').split('.').pop().toLowerCase();
const baseOf = (name) => name.split('/').pop() || name;
const trailingNewline = (s) => (s ? s.replace(/\n?$/, '\n') : '');

async function fetchWithTimeout(url, init, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw new HttpError(504, 'The code runner timed out');
    throw new HttpError(502, 'Could not reach the code runner');
  } finally {
    clearTimeout(t);
  }
}

/* ---------------- Piston ---------------- */
async function runPiston({ ext, fileName, code, stdin }) {
  const [language] = PISTON[ext];
  const base = (process.env.PISTON_URL || PISTON_PUBLIC).replace(/\/$/, '');
  const res = await fetchWithTimeout(
    `${base}/execute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        version: '*',
        files: [{ name: baseOf(fileName), content: code }],
        stdin,
        compile_timeout: 10000,
        run_timeout: RUN_TIMEOUT_MS,
      }),
    },
    RUN_TIMEOUT_MS + 20000
  );
  if (res.status === 429) throw new HttpError(429, 'The public code runner is busy — try again in a moment');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, data?.message || `Runner error (${res.status})`);

  const parts = [];
  let exitCode = 0;
  let status;
  if (data.compile && (data.compile.code || data.compile.signal)) {
    parts.push(trailingNewline(data.compile.output || data.compile.stderr || data.compile.stdout));
    exitCode = data.compile.code ?? 1;
    status = 'Compilation error';
  } else if (data.run) {
    parts.push(trailingNewline(data.run.output ?? `${data.run.stdout || ''}${data.run.stderr || ''}`));
    exitCode = data.run.code ?? (data.run.signal ? 1 : 0);
    if (data.run.signal === 'SIGKILL') status = `Time limit exceeded (${RUN_TIMEOUT_MS / 1000}s)`;
    else if (data.run.signal) status = `Killed by ${data.run.signal}`;
  }
  if (status) parts.push(`\n[${status}]\n`);
  return { output: parts.join(''), exitCode, runner: 'piston', version: data.version };
}

/* ---------------- JDoodle ---------------- */
async function runJdoodle({ ext, code, stdin }) {
  const res = await fetchWithTimeout(
    'https://api.jdoodle.com/v1/execute',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: process.env.JDOODLE_CLIENT_ID, clientSecret: process.env.JDOODLE_CLIENT_SECRET, script: code, language: JDOODLE[ext], stdin, versionIndex: '0' }),
    },
    RUN_TIMEOUT_MS + 25000
  );
  const data = await res.json().catch(() => ({}));
  if (data.statusCode !== 200) throw new HttpError(502, data.error || 'Failed to execute code');
  return { output: data.output ?? '', exitCode: 0, runner: 'jdoodle' };
}

/** Execute `code` for `fileName` with `stdin`. Returns { output, exitCode, runner, time?, version? } */
export async function runCode({ fileName, code, stdin = '' }) {
  const ext = extOf(fileName);
  const info = runnerInfo();
  if (info.kind === 'none') throw new HttpError(503, 'No code runner is configured on this server (set PISTON_URL, JUDGE0_URL or JDoodle keys)');
  if (!info.languages.includes(ext)) throw new HttpError(400, `Unsupported file type: .${ext}`);
  const args = { ext, fileName, code, stdin };
  if (info.kind === 'local') return runLocal({ ...args, timeoutMs: RUN_TIMEOUT_MS, HttpError });
  if (info.kind === 'piston') return runPiston(args);
  if (info.kind === 'judge0') return runJudge0({ ...args, timeoutMs: RUN_TIMEOUT_MS, HttpError, fetchWithTimeout });
  return runJdoodle(args);
}

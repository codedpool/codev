// Judge0 runner (https://judge0.com). Works with:
//   - the public CE instance  JUDGE0_URL=https://ce.judge0.com   (free, rate-limited, no key — good for dev/small projects)
//   - a self-hosted instance  JUDGE0_URL=http://host:2358        (+ JUDGE0_AUTH_TOKEN if you enabled authentication)
//   - RapidAPI               JUDGE0_RAPIDAPI_KEY=...             (host defaults to judge0-ce.p.rapidapi.com)
// Language ids are resolved from the instance's /languages list (newest matching version), so the map below
// works across Judge0 versions and hosts.

/** ext -> RegExp matched against Judge0 language names, e.g. "Python (3.12.5)", "C++ (GCC 14.1.0)". */
export const JUDGE0_LANGS = {
  py: /^Python \(3/, js: /^JavaScript \(Node\.js/, mjs: /^JavaScript \(Node\.js/, ts: /^TypeScript/, cpp: /^C\+\+ \(GCC/, cc: /^C\+\+ \(GCC/, c: /^C \(GCC/,
  java: /^Java \((Open)?JDK/, go: /^Go /, rs: /^Rust/, rb: /^Ruby/, php: /^PHP/, cs: /^C# /, kt: /^Kotlin/, swift: /^Swift/, sh: /^Bash/, sql: /^SQL/,
  r: /^R \(/, scala: /^Scala/, lua: /^Lua/, pl: /^Perl/, hs: /^Haskell/, dart: /^Dart/, clj: /^Clojure/, ex: /^Elixir/, exs: /^Elixir/, erl: /^Erlang/,
  fs: /^F#/, f90: /^Fortran/, groovy: /^Groovy/, lisp: /^Common Lisp/, ml: /^OCaml/, m: /^Octave/, pas: /^Pascal/, pro: /^Prolog/, d: /^D \(/,
  cob: /^COBOL/, asm: /^Assembly/, vb: /^Visual Basic/, bas: /^Basic/,
};

// Fallback ids (Judge0 CE 1.13) if /languages can't be fetched.
const FALLBACK_IDS = { py: 71, js: 63, mjs: 63, ts: 74, cpp: 54, cc: 54, c: 50, java: 62, go: 60, rs: 73, rb: 72, php: 68, cs: 51, kt: 78, swift: 83, sh: 46, sql: 82, r: 80, scala: 81, lua: 64, pl: 85, hs: 61, dart: 90, clj: 86, ex: 57, exs: 57, erl: 58, fs: 87, f90: 59, groovy: 88, lisp: 55, ml: 65, m: 66, pas: 67, pro: 69, d: 56, cob: 77, asm: 45, vb: 84, bas: 47 };

const CACHE_MS = 60 * 60 * 1000;
let cache = { at: 0, base: '', ids: null, names: null };

export function judge0Config() {
  const rapid = process.env.JUDGE0_RAPIDAPI_KEY;
  const base = (process.env.JUDGE0_URL || (rapid ? `https://${process.env.JUDGE0_RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com'}` : '')).replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.JUDGE0_AUTH_TOKEN) headers['X-Auth-Token'] = process.env.JUDGE0_AUTH_TOKEN;
  if (rapid) {
    headers['X-RapidAPI-Key'] = rapid;
    headers['X-RapidAPI-Host'] = process.env.JUDGE0_RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com';
  }
  return { base, headers };
}

const versionOf = (name) => {
  const m = name.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?\)?\s*$/) || name.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)] : [0, 0, 0];
};
const newer = (a, b) => {
  const va = versionOf(a.name), vb = versionOf(b.name);
  for (let i = 0; i < 3; i++) if (va[i] !== vb[i]) return va[i] > vb[i] ? a : b;
  return a.id > b.id ? a : b;
};

/** Resolve { ext -> language id } for the configured instance. Cached for an hour; falls back to static ids. */
export async function judge0LanguageIds(fetchFn = fetch) {
  const { base, headers } = judge0Config();
  if (cache.ids && cache.base === base && Date.now() - cache.at < CACHE_MS) return cache;
  const ids = { ...FALLBACK_IDS };
  const names = {};
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetchFn(`${base}/languages`, { headers, signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      const list = await res.json();
      for (const [ext, re] of Object.entries(JUDGE0_LANGS)) {
        const best = list.filter((l) => re.test(l.name)).reduce((a, b) => (a ? newer(a, b) : b), null);
        if (best) { ids[ext] = best.id; names[ext] = best.name; }
        else delete ids[ext]; // instance doesn't offer it
      }
      cache = { at: Date.now(), base, ids, names };
    }
  } catch { /* keep fallback ids, retry next call */ }
  return cache.ids ? cache : { at: 0, base, ids, names };
}

const b64 = (s) => Buffer.from(String(s ?? ''), 'utf8').toString('base64');
const unb64 = (s) => (s ? Buffer.from(s, 'base64').toString('utf8') : '');

/** Judge0 always compiles Java as Main.java, so a `public class Hello` would fail — rename it to Main. */
export function prepareJava(code) {
  const m = code.match(/\bpublic\s+(?:final\s+|abstract\s+)*class\s+([A-Za-z_$][\w$]*)/);
  if (!m || m[1] === 'Main' || /\bclass\s+Main\b/.test(code)) return code;
  const ident = new RegExp(`\\b${m[1]}\\b`, 'g');
  // Rename only in code — leave string/char literals, text blocks and comments untouched.
  const tokens = /"""[\s\S]*?"""|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
  let out = '';
  let last = 0;
  for (const t of code.matchAll(tokens)) {
    out += code.slice(last, t.index).replace(ident, 'Main') + t[0];
    last = t.index + t[0].length;
  }
  return out + code.slice(last).replace(ident, 'Main');
}

export async function runJudge0({ ext, fileName, code, stdin, timeoutMs, HttpError, fetchWithTimeout }) {
  const { base, headers } = judge0Config();
  const { ids, names } = await judge0LanguageIds();
  const languageId = ids[ext];
  if (!languageId) throw new HttpError(400, `.${ext} is not available on this Judge0 instance`);
  if (ext === 'java') code = prepareJava(code);

  const body = JSON.stringify({
    source_code: b64(code),
    language_id: languageId,
    stdin: b64(stdin),
    cpu_time_limit: Math.max(1, Math.round(timeoutMs / 1000)),
    wall_time_limit: Math.max(2, Math.round(timeoutMs / 1000) + 5),
    memory_limit: 256000,
  });
  let res = await fetchWithTimeout(`${base}/submissions?base64_encoded=true&wait=true`, { method: 'POST', headers, body }, timeoutMs + 25000);
  if (res.status === 429) throw new HttpError(429, 'The code runner is rate-limited right now — try again in a few seconds');
  if (res.status === 401 || res.status === 403) throw new HttpError(502, 'The code runner rejected our credentials (check JUDGE0_AUTH_TOKEN / JUDGE0_RAPIDAPI_KEY)');
  if (!res.ok) throw new HttpError(502, `Runner error (${res.status})`);
  let r = await res.json();

  // Instances without wait=true return just { token } (or a queued status) — poll.
  const deadline = Date.now() + timeoutMs + 20000;
  while (r?.token && (!r.status || r.status.id <= 2) && Date.now() < deadline) {
    await new Promise((ok) => setTimeout(ok, 700));
    res = await fetchWithTimeout(`${base}/submissions/${r.token}?base64_encoded=true`, { headers }, 10000);
    if (!res.ok) throw new HttpError(502, `Runner error (${res.status})`);
    r = await res.json();
  }
  if (!r?.status || r.status.id <= 2) throw new HttpError(504, 'The code runner did not finish in time');

  // Judge0 saves the source as /box/script.<ext> (Main.java for Java); show the user's real file name in diagnostics.
  const realName = (fileName || '').split('/').pop() || `script.${ext}`;
  const fixNames = (s) => (s ? s.replace(/(?:\/box\/)?(?:script\.[A-Za-z0-9]+|Main\.java)\b/g, realName) : s);
  const parts = [];
  const compileOut = fixNames(unb64(r.compile_output));
  const stdout = unb64(r.stdout);
  const stderr = fixNames(unb64(r.stderr));
  if (compileOut) parts.push(compileOut);
  if (stdout) parts.push(stdout);
  if (stderr) parts.push(stderr);
  const status = r.status.description || '';
  const ok = r.status.id === 3; // Accepted
  if (ok && r.message && !stdout && !stderr && !compileOut) parts.push(unb64(r.message));
  let out = parts.join('');
  if (!ok) {
    let label = status;
    if (r.status.id === 5) label = `Time limit exceeded (${Math.round(timeoutMs / 1000)}s)`;
    else if (r.status.id === 6) label = 'Compilation error';
    else if (r.status.id >= 7 && r.status.id <= 12) label = `Runtime error${r.exit_code != null ? ` (exit code ${r.exit_code})` : ''}${r.exit_signal ? ` (${status})` : ''}`;
    out = `${out.replace(/\n?$/, out ? '\n' : '')}\n[${label}]\n`;
  }
  return {
    output: out.replace(/\n?$/, '\n'),
    exitCode: ok ? 0 : (r.exit_code ?? 1),
    time: r.time,
    memory: r.memory,
    runner: 'judge0',
    version: names[ext],
  };
}

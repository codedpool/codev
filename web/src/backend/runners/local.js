// Local runner: executes code with the toolchains installed on the host machine (python, node, gcc, ...).
// Intended for local development / single-user self-hosting only — code runs with the server's privileges,
// there is no sandbox. It is only auto-selected outside production; set RUNNER=local to force it.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { accessSync, constants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const IS_WIN = process.platform === 'win32';
const EXE = IS_WIN ? '.exe' : '';
const MAX_OUTPUT = 64 * 1024;
// On Windows (MinGW) link the C++ runtime statically so the binary doesn't depend on MinGW DLLs (and to dodge a common ld failure).
const CXX_LINK = IS_WIN ? ['-static-libstdc++', '-static-libgcc'] : [];

/** Which executables provide each extension. First available wins. `{ compile?, run }` are built per file. */
const TOOLS = {
  py: { any: ['python3', 'python', 'py'], label: 'Python', run: (bin, f) => [bin, [f]] },
  js: { any: ['node'], label: 'JavaScript (Node)', run: (bin, f) => [bin, [f]] },
  mjs: { any: ['node'], label: 'JavaScript (Node)', run: (bin, f) => [bin, [f]] },
  ts: { any: ['node'], label: 'TypeScript (Node type-stripping)', run: (bin, f) => [bin, ['--experimental-strip-types', '--no-warnings', f]] },
  c: { any: ['gcc', 'clang'], label: 'C', compile: (bin, f, out) => [bin, [f, '-O1', '-o', out]], run: (_bin, _f, out) => [out, []] },
  cpp: { any: ['g++', 'clang++'], label: 'C++', compile: (bin, f, out) => [bin, ['-std=c++17', f, '-O1', ...CXX_LINK, '-o', out]], run: (_bin, _f, out) => [out, []] },
  cc: { any: ['g++', 'clang++'], label: 'C++', compile: (bin, f, out) => [bin, ['-std=c++17', f, '-O1', ...CXX_LINK, '-o', out]], run: (_bin, _f, out) => [out, []] },
  java: { any: ['java'], label: 'Java', needs: ['javac'], compile: (_bin, f) => ['javac', [f]], run: (bin, f) => [bin, ['-cp', path.dirname(f), path.basename(f, '.java')]] },
  go: { any: ['go'], label: 'Go', run: (bin, f) => [bin, ['run', f]] },
  rs: { any: ['rustc'], label: 'Rust', compile: (bin, f, out) => [bin, [f, '-o', out]], run: (_bin, _f, out) => [out, []] },
  rb: { any: ['ruby'], label: 'Ruby', run: (bin, f) => [bin, [f]] },
  php: { any: ['php'], label: 'PHP', run: (bin, f) => [bin, [f]] },
  sh: { any: ['bash'], label: 'Bash', run: (bin, f) => [bin, [f]] },
  ps1: { any: ['pwsh', 'powershell'], label: 'PowerShell', run: (bin, f) => [bin, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', f]] },
  kt: { any: ['kotlinc'], label: 'Kotlin', compile: (bin, f, out) => [bin, [f, '-include-runtime', '-d', out + '.jar']], run: (_bin, _f, out) => ['java', ['-jar', out + '.jar']] },
  lua: { any: ['lua', 'lua5.4'], label: 'Lua', run: (bin, f) => [bin, [f]] },
  pl: { any: ['perl'], label: 'Perl', run: (bin, f) => [bin, [f]] },
  r: { any: ['Rscript'], label: 'R', run: (bin, f) => [bin, [f]] },
  dart: { any: ['dart'], label: 'Dart', run: (bin, f) => [bin, ['run', f]] },
  swift: { any: ['swift'], label: 'Swift', run: (bin, f) => [bin, [f]] },
};

const whichCache = new Map();
function which(cmd) {
  if (whichCache.has(cmd)) return whichCache.get(cmd);
  const exts = IS_WIN ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
  let found = null;
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext.toLowerCase());
      try {
        accessSync(p, constants.X_OK);
        found = p;
        break;
      } catch { /* try next */ }
    }
    if (found) break;
  }
  // The Windows Store "python.exe" shim exists but only opens the store; skip it.
  if (found && IS_WIN && /WindowsApps/i.test(found)) found = null;
  whichCache.set(cmd, found);
  return found;
}

let langCache;
/** Extensions runnable on this machine (tools present in PATH). */
export function localLanguages() {
  if (langCache) return langCache;
  langCache = Object.entries(TOOLS)
    .filter(([, t]) => t.any.some(which) && (t.needs || []).every(which))
    .map(([ext]) => ext);
  return langCache;
}

function exec(bin, args, { cwd, stdin, timeoutMs }) {
  return new Promise((resolve) => {
    const started = Date.now();
    let out = '';
    let truncated = false;
    let timedOut = false;
    const child = spawn(bin, args, { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const push = (chunk) => {
      if (out.length >= MAX_OUTPUT) { truncated = true; return; }
      out += chunk.toString('utf8');
      if (out.length > MAX_OUTPUT) { out = out.slice(0, MAX_OUTPUT); truncated = true; }
    };
    child.stdout.on('data', push);
    child.stderr.on('data', push);
    const timer = setTimeout(() => {
      timedOut = true;
      if (IS_WIN) spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
      else child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: 1, out: `${e.message}\n`, timedOut, truncated, ms: Date.now() - started }); });
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code: code ?? (signal ? 1 : 0), out, timedOut, truncated, ms: Date.now() - started }); });
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
  });
}

export async function runLocal({ ext, fileName, code, stdin, timeoutMs, HttpError }) {
  const tool = TOOLS[ext];
  const bin = tool && tool.any.map(which).find(Boolean);
  if (!bin) throw new HttpError(400, `No local toolchain for .${ext}`);
  const dir = await mkdtemp(path.join(tmpdir(), 'codev-run-'));
  try {
    const base = path.basename(fileName) || `main.${ext}`;
    const file = path.join(dir, base);
    await writeFile(file, code, 'utf8');
    const out = path.join(dir, 'a' + EXE);
    const parts = [];
    if (tool.compile) {
      const [cbin, cargs] = tool.compile(bin, file, out);
      const c = await exec(which(cbin) || cbin, cargs, { cwd: dir, timeoutMs: 20000 });
      if (c.code !== 0 || c.timedOut) {
        parts.push(c.out.replaceAll(dir + path.sep, ''), '\n[Compilation error]\n');
        return { output: parts.join(''), exitCode: c.code || 1, runner: 'local' };
      }
    }
    const [rbin, rargs] = tool.run(bin, file, out);
    const r = await exec(rbin === out ? out : which(rbin) || rbin, rargs, { cwd: dir, stdin, timeoutMs });
    parts.push(r.out.replaceAll(dir + path.sep, ''));
    if (r.truncated) parts.push('\n[Output truncated]\n');
    if (r.timedOut) parts.push(`\n[Time limit exceeded (${timeoutMs / 1000}s)]\n`);
    else if (r.code !== 0) parts.push(`\n[Process exited with code ${r.code}]\n`);
    return { output: parts.join('').replace(/\n?$/, '\n'), exitCode: r.timedOut ? 124 : r.code, time: (r.ms / 1000).toFixed(2), runner: 'local' };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export const localLabels = Object.fromEntries(Object.entries(TOOLS).map(([k, v]) => [k, v.label]));

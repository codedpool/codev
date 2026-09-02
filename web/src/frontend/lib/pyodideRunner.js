'use client';
// In-browser Python via Pyodide (WebAssembly CPython) in a Web Worker.
// No server, no key, no rate limit — the interpreter (~12 MB) is downloaded from jsDelivr on first use and cached by the browser.
// Used for .py files when Settings → "Run Python in the browser" is on, or as a fallback when the server runner is unavailable.

const PYODIDE_VERSION = process.env.NEXT_PUBLIC_PYODIDE_VERSION || '314.0.5';
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// The worker source is inlined so it needs no extra build config.
const WORKER_SRC = `
let pyodide = null, ready = null;
function boot() {
  if (ready) return ready;
  ready = (async () => {
    const mod = await import(INDEX_URL + 'pyodide.mjs');
    pyodide = await mod.loadPyodide({ indexURL: INDEX_URL });
    return pyodide;
  })();
  return ready;
}
self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'warmup') { try { await boot(); postMessage({ type: 'ready' }); } catch (err) { postMessage({ type: 'error', message: String(err && err.message || err) }); } return; }
  if (msg.type !== 'run') return;
  const id = msg.id;
  try {
    postMessage({ type: 'status', id, status: pyodide ? 'running' : 'loading' });
    const py = await boot();
    postMessage({ type: 'status', id, status: 'running' });
    const lines = String(msg.stdin || '').split('\\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    let li = 0;
    py.setStdin({ stdin: () => (li < lines.length ? lines[li++] + '\\n' : null), isatty: false });
    py.setStdout({ batched: (s) => postMessage({ type: 'out', id, text: s + '\\n' }) });
    py.setStderr({ batched: (s) => postMessage({ type: 'err', id, text: s + '\\n' }) });
    // Fresh globals per run so state doesn't leak between runs; keep sys.argv sane.
    const ns = py.globals.get('dict')();
    ns.set('__name__', '__main__');
    ns.set('__file__', msg.fileName || 'main.py');
    py.runPython('import sys\\nsys.argv = [' + JSON.stringify(msg.fileName || 'main.py') + ']', { globals: ns });
    const started = Date.now();
    let exitCode = 0;
    try {
      await py.runPythonAsync(msg.code, { globals: ns });
    } catch (err) {
      const text = String(err && err.message || err);
      // SystemExit carries the code; other exceptions → traceback text
      const m = text.match(/SystemExit: (\\d+)/);
      if (m) exitCode = Number(m[1]);
      else if (/SystemExit/.test(text)) exitCode = 0;
      else { exitCode = 1; postMessage({ type: 'err', id, text: text.replace(/^.*?File "<exec>"/s, 'Traceback (most recent call last):\\n  File "<exec>"') }); }
    } finally {
      try { ns.destroy(); } catch (_) {}
    }
    postMessage({ type: 'done', id, exitCode, ms: Date.now() - started });
  } catch (err) {
    postMessage({ type: 'error', id, message: String(err && err.message || err) });
  }
};
`;

let worker = null;
let workerReady = false;
let seq = 0;
const listeners = new Map();

function makeWorker() {
  const src = `const INDEX_URL = ${JSON.stringify(INDEX_URL)};\n${WORKER_SRC}`;
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  const w = new Worker(url, { type: 'module' }); // Pyodide ≥ 0.28 requires a module worker
  URL.revokeObjectURL(url);
  w.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'ready') { workerReady = true; return; }
    const l = m.id != null ? listeners.get(m.id) : null;
    if (l) l(m);
  };
  w.onerror = (e) => { for (const l of listeners.values()) l({ type: 'error', message: e.message || 'Python worker crashed' }); };
  return w;
}

function getWorker() {
  if (!worker) worker = makeWorker();
  return worker;
}

/** Start downloading/initialising Pyodide in the background (call when the user enables browser Python). */
export function warmupPyodide() {
  if (typeof window === 'undefined') return;
  const w = getWorker();
  if (!workerReady) w.postMessage({ type: 'warmup' });
}

export const pyodideSupported = () => typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';

/**
 * Run Python code in the browser.
 * @param {{ code: string, stdin?: string, fileName?: string, timeoutMs?: number, signal?: AbortSignal, onOutput?: (text: string, stream: 'out'|'err') => void, onStatus?: (s: 'loading'|'running') => void }} opts
 * @returns {Promise<{ output: string, exitCode: number, time: string, runner: 'pyodide' }>}
 */
export function runPython({ code, stdin = '', fileName = 'main.py', timeoutMs = 15000, signal, onOutput, onStatus }) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    let output = '';
    let timer = null;
    let loading = !workerReady;
    const cleanup = () => { listeners.delete(id); clearTimeout(timer); signal?.removeEventListener('abort', onAbort); };
    const kill = (why) => {
      cleanup();
      try { worker?.terminate(); } catch { /* ignore */ }
      worker = null; workerReady = false;
      reject(Object.assign(new Error(why), { output, name: why === 'aborted' ? 'AbortError' : 'Error' }));
    };
    const onAbort = () => kill('aborted');
    const armTimeout = () => { clearTimeout(timer); timer = setTimeout(() => kill(`Time limit exceeded (${Math.round(timeoutMs / 1000)}s)`), timeoutMs); };
    listeners.set(id, (m) => {
      if (m.type === 'status') {
        onStatus?.(m.status);
        if (m.status === 'running') { loading = false; workerReady = true; armTimeout(); }
      } else if (m.type === 'out' || m.type === 'err') {
        output += m.text;
        onOutput?.(m.text, m.type);
      } else if (m.type === 'done') {
        cleanup();
        resolve({ output, exitCode: m.exitCode, time: (m.ms / 1000).toFixed(2), runner: 'pyodide' });
      } else if (m.type === 'error') {
        cleanup();
        reject(Object.assign(new Error(m.message || 'Python failed to start'), { output }));
      }
    });
    signal?.addEventListener('abort', onAbort);
    // While Pyodide downloads, use a generous timeout; the real time limit starts when the code runs.
    if (loading) timer = setTimeout(() => kill('Timed out downloading the Python runtime — check your connection and try again'), 120000);
    else armTimeout();
    getWorker().postMessage({ type: 'run', id, code, stdin, fileName });
  });
}

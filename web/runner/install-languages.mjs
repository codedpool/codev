// Installs the language packages Codev uses into a self-hosted Piston instance.
//   node runner/install-languages.mjs [http://localhost:2000/api/v2]
// Re-run any time; already-installed packages are skipped.
const base = (process.argv[2] || process.env.PISTON_URL || 'http://localhost:2000/api/v2').replace(/\/$/, '');

// Keep in sync with the PISTON map in src/server/runner.js. Version '*' picks the newest available package.
const WANTED = ['python', 'javascript', 'typescript', 'c++', 'c', 'java', 'go', 'rust', 'ruby', 'php', 'csharp.net', 'kotlin', 'swift', 'bash', 'sqlite3', 'rscript', 'scala', 'lua', 'perl', 'haskell', 'dart'];

const j = (r) => r.json();
const available = await fetch(`${base}/packages`).then(j);
const installed = new Set(available.filter((p) => p.installed).map((p) => p.language));
for (const lang of WANTED) {
  const candidates = available.filter((p) => p.language === lang);
  if (!candidates.length) { console.log(`skip ${lang}: not offered by this Piston build`); continue; }
  if (installed.has(lang)) { console.log(`ok   ${lang} (installed)`); continue; }
  const pkg = candidates.sort((a, b) => b.language_version.localeCompare(a.language_version, undefined, { numeric: true }))[0];
  process.stdout.write(`add  ${lang}@${pkg.language_version} ... `);
  const res = await fetch(`${base}/packages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: lang, version: pkg.language_version }) });
  console.log(res.ok ? 'done' : `failed (${res.status}) ${await res.text()}`);
}
console.log('\nRuntimes now available:');
console.log((await fetch(`${base}/runtimes`).then(j)).map((r) => `${r.language}@${r.version}`).join(', '));

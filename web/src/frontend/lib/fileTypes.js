// File-type registry: language ids, labels, colors, run support and icons.
export const RUNNABLE = new Set(['cpp', 'java', 'py', 'js']);
/** Replace the runnable set from server capabilities (Judge0 supports many more languages). */
export function setRunnable(exts) {
  if (!Array.isArray(exts)) return;
  RUNNABLE.clear();
  exts.forEach((e) => RUNNABLE.add(e));
}

const TYPES = {
  js:   { lang: 'javascript', label: 'JavaScript', color: '#f1e05a', glyph: 'JS' },
  jsx:  { lang: 'javascript', label: 'JavaScript JSX', color: '#61dafb', glyph: 'JSX' },
  mjs:  { lang: 'javascript', label: 'JavaScript', color: '#f1e05a', glyph: 'JS' },
  cjs:  { lang: 'javascript', label: 'JavaScript', color: '#f1e05a', glyph: 'JS' },
  ts:   { lang: 'typescript', label: 'TypeScript', color: '#3b82f6', glyph: 'TS' },
  tsx:  { lang: 'typescript', label: 'TypeScript JSX', color: '#3b82f6', glyph: 'TSX' },
  py:   { lang: 'python', label: 'Python', color: '#4b8bbe', glyph: 'PY' },
  java: { lang: 'java', label: 'Java', color: '#e76f00', glyph: 'JV' },
  cpp:  { lang: 'cpp', label: 'C++', color: '#659ad2', glyph: 'C++' },
  cc:   { lang: 'cpp', label: 'C++', color: '#659ad2', glyph: 'C++' },
  cxx:  { lang: 'cpp', label: 'C++', color: '#659ad2', glyph: 'C++' },
  hpp:  { lang: 'cpp', label: 'C++ Header', color: '#8ab4dd', glyph: 'H' },
  h:    { lang: 'cpp', label: 'C Header', color: '#8ab4dd', glyph: 'H' },
  c:    { lang: 'c', label: 'C', color: '#a8b9cc', glyph: 'C' },
  html: { lang: 'html', label: 'HTML', color: '#e34c26', glyph: '<>' },
  htm:  { lang: 'html', label: 'HTML', color: '#e34c26', glyph: '<>' },
  css:  { lang: 'css', label: 'CSS', color: '#7c8cff', glyph: '#' },
  scss: { lang: 'css', label: 'SCSS', color: '#cd6799', glyph: '#' },
  json: { lang: 'json', label: 'JSON', color: '#cbcb41', glyph: '{}' },
  md:   { lang: 'markdown', label: 'Markdown', color: '#8fa1b3', glyph: 'MD' },
  txt:  { lang: 'plaintext', label: 'Plain Text', color: '#8b93a1', glyph: 'TXT' },
  yml:  { lang: 'yaml', label: 'YAML', color: '#cb171e', glyph: 'YML' },
  yaml: { lang: 'yaml', label: 'YAML', color: '#cb171e', glyph: 'YML' },
  sh:   { lang: 'shell', label: 'Shell', color: '#89e051', glyph: '$_' },
  env:  { lang: 'plaintext', label: 'Env', color: '#e2b93d', glyph: 'ENV' },
  svg:  { lang: 'html', label: 'SVG', color: '#ffb13b', glyph: 'SVG' },
  csv:  { lang: 'plaintext', label: 'CSV', color: '#6cd58a', glyph: 'CSV' },
  sql:  { lang: 'sql', label: 'SQL', color: '#e38c00', glyph: 'SQL' },

  // Runner-supported languages beyond the editor's built-in syntax highlighting (Judge0/Piston).
  go:     { lang: 'plaintext', label: 'Go', color: '#00add8', glyph: 'GO' },
  rs:     { lang: 'plaintext', label: 'Rust', color: '#dea584', glyph: 'RS' },
  rb:     { lang: 'plaintext', label: 'Ruby', color: '#701516', glyph: 'RB' },
  php:    { lang: 'plaintext', label: 'PHP', color: '#4f5d95', glyph: 'PHP' },
  cs:     { lang: 'plaintext', label: 'C#', color: '#178600', glyph: 'C#' },
  kt:     { lang: 'plaintext', label: 'Kotlin', color: '#a97bff', glyph: 'KT' },
  swift:  { lang: 'plaintext', label: 'Swift', color: '#f05138', glyph: 'SW' },
  r:      { lang: 'plaintext', label: 'R', color: '#198ce7', glyph: 'R' },
  scala:  { lang: 'plaintext', label: 'Scala', color: '#c22d40', glyph: 'SC' },
  lua:    { lang: 'plaintext', label: 'Lua', color: '#000080', glyph: 'LUA' },
  pl:     { lang: 'plaintext', label: 'Perl', color: '#0298c3', glyph: 'PL' },
  hs:     { lang: 'plaintext', label: 'Haskell', color: '#5e5086', glyph: 'HS' },
  dart:   { lang: 'plaintext', label: 'Dart', color: '#00b4ab', glyph: 'DA' },
  clj:    { lang: 'plaintext', label: 'Clojure', color: '#5881d8', glyph: 'CLJ' },
  ex:     { lang: 'plaintext', label: 'Elixir', color: '#6e4a7e', glyph: 'EX' },
  exs:    { lang: 'plaintext', label: 'Elixir', color: '#6e4a7e', glyph: 'EX' },
  erl:    { lang: 'plaintext', label: 'Erlang', color: '#b83998', glyph: 'ER' },
  fs:     { lang: 'plaintext', label: 'F#', color: '#378bba', glyph: 'F#' },
  f90:    { lang: 'plaintext', label: 'Fortran', color: '#4d41b1', glyph: 'F90' },
  groovy: { lang: 'plaintext', label: 'Groovy', color: '#4298b8', glyph: 'GR' },
  lisp:   { lang: 'plaintext', label: 'Common Lisp', color: '#3fb68b', glyph: 'LSP' },
  ml:     { lang: 'plaintext', label: 'OCaml', color: '#ef7a08', glyph: 'ML' },
  m:      { lang: 'plaintext', label: 'Octave', color: '#0f60d0', glyph: 'OCT' },
  pas:    { lang: 'plaintext', label: 'Pascal', color: '#e3f171', glyph: 'PAS' },
  pro:    { lang: 'plaintext', label: 'Prolog', color: '#74283c', glyph: 'PRO' },
  d:      { lang: 'plaintext', label: 'D', color: '#ba595e', glyph: 'D' },
  cob:    { lang: 'plaintext', label: 'COBOL', color: '#5079af', glyph: 'COB' },
  asm:    { lang: 'plaintext', label: 'Assembly', color: '#6e4c13', glyph: 'ASM' },
  vb:     { lang: 'plaintext', label: 'Visual Basic', color: '#945db7', glyph: 'VB' },
  bas:    { lang: 'plaintext', label: 'BASIC', color: '#945db7', glyph: 'BAS' },
};

export const CREATABLE_TYPES = [
  { ext: 'js', label: 'JavaScript' },
  { ext: 'py', label: 'Python' },
  { ext: 'cpp', label: 'C++' },
  { ext: 'java', label: 'Java' },
  { ext: 'ts', label: 'TypeScript' },
  { ext: 'html', label: 'HTML' },
  { ext: 'css', label: 'CSS' },
  { ext: 'json', label: 'JSON' },
  { ext: 'md', label: 'Markdown' },
  { ext: 'txt', label: 'Plain text' },
];

export function extOf(name = '') {
  const base = name.split('/').pop() || '';
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
}
export function baseName(path = '') {
  return path.split('/').pop() || path;
}
export function dirName(path = '') {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}
const PLAIN = { lang: 'plaintext', label: 'Plain Text', color: '#8b93a1', glyph: 'TXT' };
export function fileType(name) {
  return TYPES[extOf(name)] || PLAIN;
}
export function languageLabel(name) {
  return fileType(name).label;
}
export function isRunnable(name) {
  return RUNNABLE.has(extOf(name));
}
export function runCommandFor(name) {
  const b = baseName(name);
  switch (extOf(name)) {
    case 'js': return `node ${b}`;
    case 'ts': return `ts-node ${b}`;
    case 'py': return `python3 ${b}`;
    case 'java': return `javac ${b} && java ${b.replace(/\.java$/, '')}`;
    case 'cpp': case 'cc': return `g++ -std=c++17 ${b} -o a.out && ./a.out`;
    case 'c': return `gcc ${b} -o a.out && ./a.out`;
    case 'go': return `go run ${b}`;
    case 'rs': return `rustc ${b} -o a.out && ./a.out`;
    case 'rb': return `ruby ${b}`;
    case 'php': return `php ${b}`;
    case 'cs': return `dotnet run ${b}`;
    case 'kt': return `kotlinc ${b} -include-runtime -d a.jar && java -jar a.jar`;
    case 'sh': return `bash ${b}`;
    case 'go': return `go run ${b}`;
    case 'swift': return `swift ${b}`;
    case 'sql': return `sqlite3 :memory: < ${b}`;
    case 'r': return `Rscript ${b}`;
    case 'scala': return `scala ${b}`;
    case 'lua': return `lua ${b}`;
    case 'pl': return `perl ${b}`;
    case 'hs': return `runghc ${b}`;
    case 'dart': return `dart run ${b}`;
    case 'clj': return `clojure ${b}`;
    case 'ex': case 'exs': return `elixir ${b}`;
    case 'erl': return `escript ${b}`;
    case 'fs': return `dotnet fsi ${b}`;
    case 'f90': return `gfortran ${b} -o a.out && ./a.out`;
    case 'groovy': return `groovy ${b}`;
    case 'lisp': return `sbcl --script ${b}`;
    case 'ml': return `ocaml ${b}`;
    case 'm': return `octave --no-gui ${b}`;
    case 'pas': return `fpc ${b} && ./${b.replace(/\.pas$/, '')}`;
    case 'pro': return `swipl -q -f ${b}`;
    case 'd': return `dmd -run ${b}`;
    case 'cob': return `cobc -x ${b} -o a.out && ./a.out`;
    case 'asm': return `nasm -f elf64 ${b} -o a.o && ld a.o -o a.out && ./a.out`;
    case 'vb': case 'bas': return `vbnc ${b} && mono ${b.replace(/\.(vb|bas)$/, '.exe')}`;
    default: return `run ${b}`;
  }
}
export function templateFor(name) {
  const b = baseName(name);
  switch (extOf(name)) {
    case 'py': return 'def main():\n    print("Hello from Codev")\n\n\nif __name__ == "__main__":\n    main()\n';
    case 'js': return 'function main() {\n  console.log("Hello from Codev");\n}\n\nmain();\n';
    case 'cpp': return '#include <iostream>\n\nint main() {\n    std::cout << "Hello from Codev" << std::endl;\n    return 0;\n}\n';
    case 'java': {
      const cls = b.replace(/\.java$/, '') || 'Main';
      return 'public class ' + cls + ' {\n    public static void main(String[] args) {\n        System.out.println("Hello from Codev");\n    }\n}\n';
    }
    default: return '';
  }
}

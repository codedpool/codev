import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { extOf } from '../lib/fileTypes';

export function languageFor(fileName) {
  switch (extOf(fileName)) {
    case 'js': case 'mjs': case 'cjs': return javascript();
    case 'jsx': return javascript({ jsx: true });
    case 'ts': return javascript({ typescript: true });
    case 'tsx': return javascript({ typescript: true, jsx: true });
    case 'py': return python();
    case 'java': return java();
    case 'cpp': case 'cc': case 'cxx': case 'c': case 'h': case 'hpp': return cpp();
    case 'html': case 'htm': case 'svg': return html();
    case 'css': case 'scss': return css();
    case 'json': return json();
    case 'md': return markdown();
    default: return [];
  }
}

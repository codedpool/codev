// "Codev Dark" — the editor theme that defines the product's syntax identity.
// Cool neutral canvas, a restrained 6-hue palette, lime cursor / bracket accents.
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { oneDark } from '@codemirror/theme-one-dark';

const c = {
  bg: '#0c0e12',
  fg: '#d9dee7',
  gutter: '#0c0e12',
  gutterFg: '#3f4652',
  gutterActive: '#a5acb8',
  activeLine: 'rgba(255,255,255,0.028)',
  selection: 'rgba(120, 145, 190, 0.28)',
  selectionMatch: 'rgba(255,255,255,0.09)',
  cursor: '#c8f04a',
  bracket: 'rgba(200,240,74,0.55)',
  comment: '#5a6372',
  keyword: '#b48eff',
  fn: '#7cc4ff',
  variable: '#d9dee7',
  property: '#a9c4e6',
  string: '#bde27a',
  regexp: '#e5c07b',
  number: '#f0a35e',
  type: '#6ee7d8',
  operator: '#9aa4b2',
  punct: '#7f8794',
  tag: '#f38aa5',
  attr: '#f0a35e',
  invalid: '#f0655f',
  link: '#60a5fa',
  heading: '#e8eaef',
  meta: '#8b93a1',
};

export const codevDarkTheme = EditorView.theme(
  {
    '&': { color: c.fg, backgroundColor: c.bg, height: '100%' },
    '.cm-scroller': { fontFamily: 'var(--editor-font, var(--font-mono))', fontSize: 'var(--editor-font-size, 13px)', lineHeight: 'var(--editor-line-height, 1.6)' },
    '.cm-content': { caretColor: c.cursor, padding: '8px 0 40vh' },
    '.cm-line': { padding: '0 16px 0 4px' },
    '&.cm-focused .cm-cursor, .cm-cursor': { borderLeftColor: c.cursor, borderLeftWidth: '2px' },
    '.cm-cursor-secondary': { borderLeftColor: 'rgba(200,240,74,0.5)' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: c.selection },
    '.cm-selectionMatch': { backgroundColor: c.selectionMatch, borderRadius: '2px' },
    '.cm-activeLine': { backgroundColor: c.activeLine },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: c.gutterActive },
    '.cm-gutters': { backgroundColor: c.gutter, color: c.gutterFg, border: 'none', paddingLeft: '6px' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 6px', minWidth: '38px' },
    '.cm-foldGutter .cm-gutterElement': { padding: '0 2px', color: c.gutterFg, opacity: 0, transition: 'opacity 120ms' },
    '.cm-gutters:hover .cm-foldGutter .cm-gutterElement, .cm-foldGutter .cm-gutterElement.cm-folded': { opacity: 1 },
    '.cm-foldPlaceholder': { backgroundColor: 'rgba(255,255,255,0.08)', border: 'none', color: '#a5acb8', borderRadius: '3px', padding: '0 6px', margin: '0 4px' },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': { backgroundColor: 'rgba(200,240,74,0.10)', outline: `1px solid ${c.bracket}`, borderRadius: '2px' },
    '.cm-nonmatchingBracket': { color: c.invalid },
  },
  { dark: true }
);

// Chrome shared by every editor theme: tooltips, panels, ghost text, remote cursors, scrollbars.
export const codevChromeTheme = EditorView.theme(
  {
    '.cm-tooltip': { backgroundColor: '#161920', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '6px', boxShadow: '0 8px 28px rgba(0,0,0,0.5)', color: '#e8eaef', fontFamily: 'var(--font-ui)', fontSize: '12px' },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-mono)', fontSize: '12px', maxHeight: '240px' },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '3px 8px', lineHeight: '1.5' },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' },
    '.cm-completionIcon': { opacity: 0.6, width: '1.2em' },
    '.cm-completionMatchedText': { textDecoration: 'none', color: '#c8f04a', fontWeight: 600 },
    '.cm-completionDetail': { color: '#6f7784', fontStyle: 'normal', marginLeft: '8px' },
    '.cm-panels': { backgroundColor: '#0f1115', color: '#e8eaef', borderColor: 'rgba(255,255,255,0.07)' },
    '.cm-panels.cm-panels-top': { borderBottom: '1px solid rgba(255,255,255,0.07)' },
    '.cm-panels.cm-panels-bottom': { borderTop: '1px solid rgba(255,255,255,0.07)' },
    '.cm-panel.cm-search': { fontFamily: 'var(--font-ui)', fontSize: '12px', padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: '4px 6px', alignItems: 'center' },
    '.cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label': { fontFamily: 'var(--font-ui)', fontSize: '12px' },
    '.cm-panel.cm-search .cm-textfield': { backgroundColor: '#0d0f13', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '4px', padding: '3px 6px', color: '#e8eaef', outline: 'none' },
    '.cm-panel.cm-search .cm-textfield:focus': { borderColor: '#c8f04a' },
    '.cm-panel.cm-search .cm-button': { backgroundImage: 'none', backgroundColor: '#14171c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '4px', color: '#e8eaef', padding: '2px 8px', cursor: 'pointer' },
    '.cm-panel.cm-search .cm-button:hover': { backgroundColor: '#1a1e25' },
    '.cm-panel.cm-search label': { color: '#a5acb8', display: 'inline-flex', alignItems: 'center', gap: '4px' },
    '.cm-panel.cm-search [name=close]': { color: '#a5acb8', fontSize: '16px', top: '4px', right: '6px' },
    '.cm-searchMatch': { backgroundColor: 'rgba(245,184,59,0.22)', outline: '1px solid rgba(245,184,59,0.4)', borderRadius: '2px' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(245,184,59,0.42)' },
    '.cm-placeholder': { color: '#4a5160', fontStyle: 'normal' },
    '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy #f0655f', textUnderlineOffset: '3px' },
    '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy #f5b83b', textUnderlineOffset: '3px' },
    '.cm-gutter-lint': { width: '10px' },
    '.cm-gutter-lint .cm-gutterElement': { padding: '0 0 0 2px' },
    '.cm-lint-marker': { width: '7px', height: '7px', borderRadius: '50%', content: 'none', marginTop: '0.45em' },
    '.cm-lint-marker-error': { content: 'none', backgroundColor: '#f0655f' },
    '.cm-lint-marker-warning': { content: 'none', backgroundColor: '#f5b83b' },
    '.cm-lint-marker-info': { content: 'none', backgroundColor: '#60a5fa' },
    '.cm-tooltip-lint': { padding: '0' },
    '.cm-diagnostic': { padding: '6px 10px', borderLeft: '2px solid', marginLeft: '0' },
    '.cm-diagnostic-error': { borderLeftColor: '#f0655f' },
    '.cm-diagnostic-warning': { borderLeftColor: '#f5b83b' },
    '.cm-diagnosticSource': { color: '#6f7784', fontSize: '10px' },
    // remote selections (y-codemirror)
    '.cm-ySelectionInfo': { fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '3px 3px 3px 0', top: '-1.35em', opacity: 1, transition: 'opacity 150ms', color: '#0b0d05' },
    '.cm-ySelectionCaret': { borderLeftWidth: '2px' },
    '.cm-ySelectionCaretDot': { display: 'none' },
    // ghost text (inline AI)
    '.cm-ghost-text': { color: '#5a6372', fontStyle: 'italic', pointerEvents: 'none', whiteSpace: 'pre' },
    '.cm-ghost-text-block': { display: 'block' },
    '.cm-ghost-hint': { fontFamily: 'var(--font-ui)', fontStyle: 'normal', fontSize: '10px', color: '#6f7784', marginLeft: '10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', padding: '0 4px', verticalAlign: 'middle' },
    '.cm-scroller::-webkit-scrollbar': { width: '12px', height: '12px' },
    '.cm-scroller::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.10)', border: '3px solid transparent', backgroundClip: 'padding-box', borderRadius: '8px' },
    '.cm-scroller::-webkit-scrollbar-thumb:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
    '.cm-scroller::-webkit-scrollbar-corner': { background: 'transparent' },
    '.cm-minimap-gutter': { borderLeft: '1px solid rgba(255,255,255,0.05)' },
  },
  { dark: true }
);

export const codevHighlightStyle = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: c.comment, fontStyle: 'italic' },
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword], color: c.keyword },
  { tag: [t.self, t.null, t.atom, t.bool, t.special(t.variableName)], color: c.number },
  { tag: [t.number, t.integer, t.float], color: c.number },
  { tag: [t.string, t.special(t.string), t.character, t.docString], color: c.string },
  { tag: [t.regexp, t.escape], color: c.regexp },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: c.fn },
  { tag: [t.definition(t.variableName), t.definition(t.function(t.variableName))], color: c.fn },
  { tag: [t.variableName, t.name, t.labelName], color: c.variable },
  { tag: [t.propertyName, t.definition(t.propertyName), t.attributeValue], color: c.property },
  { tag: [t.typeName, t.className, t.namespace, t.annotation, t.standard(t.typeName), t.definition(t.typeName)], color: c.type },
  { tag: [t.operator, t.compareOperator, t.arithmeticOperator, t.logicOperator, t.bitwiseOperator, t.updateOperator, t.definitionOperator], color: c.operator },
  { tag: [t.punctuation, t.separator, t.bracket, t.paren, t.brace, t.squareBracket, t.angleBracket], color: c.punct },
  { tag: [t.tagName, t.standard(t.tagName)], color: c.tag },
  { tag: [t.attributeName], color: c.attr },
  { tag: [t.meta, t.processingInstruction, t.documentMeta], color: c.meta },
  { tag: [t.heading, t.heading1, t.heading2, t.heading3], color: c.heading, fontWeight: '600' },
  { tag: [t.link, t.url], color: c.link, textDecoration: 'underline' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: '600' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.invalid], color: c.invalid },
  { tag: [t.inserted], color: '#4ade80' },
  { tag: [t.deleted], color: c.invalid },
  { tag: [t.changed], color: c.number },
]);

export const codevDark = [codevDarkTheme, codevChromeTheme, syntaxHighlighting(codevHighlightStyle)];

export const EDITOR_THEMES = [
  { id: 'codev-dark', label: 'Codev Dark', ext: codevDark },
  { id: 'one-dark', label: 'One Dark', ext: [oneDark, codevChromeTheme] },
];

export function themeById(id) {
  return (EDITOR_THEMES.find((th) => th.id === id) || EDITOR_THEMES[0]).ext;
}

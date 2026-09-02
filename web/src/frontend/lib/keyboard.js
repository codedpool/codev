export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';

/** Turn "Mod+Shift+P" into display parts like ["Ctrl","Shift","P"] */
export function shortcutParts(combo) {
  if (!combo) return [];
  return combo.split('+').map((k) => {
    if (k === 'Mod') return MOD;
    if (k === 'Shift') return isMac ? '⇧' : 'Shift';
    if (k === 'Alt') return isMac ? '⌥' : 'Alt';
    if (k === 'Enter') return isMac ? '↵' : 'Enter';
    if (k === 'Escape') return 'Esc';
    if (k === 'Backspace') return isMac ? '⌫' : 'Backspace';
    if (k === 'ArrowUp') return '↑';
    if (k === 'ArrowDown') return '↓';
    if (k === 'Backquote') return '`';
    if (k === 'Comma') return ',';
    return k;
  });
}

/** Does a keyboard event match a "Mod+Shift+K" combo? */
export function matchesCombo(e, combo) {
  const parts = combo.split('+');
  const key = parts[parts.length - 1];
  const wantMod = parts.includes('Mod');
  const wantShift = parts.includes('Shift');
  const wantAlt = parts.includes('Alt');
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (wantMod !== mod) return false;
  if (wantShift !== e.shiftKey) return false;
  if (wantAlt !== e.altKey) return false;
  if (key === 'Backquote') return e.code === 'Backquote';
  if (key === 'Comma') return e.code === 'Comma';
  if (key === '/') return e.code === 'Slash' || e.key === '/' || e.key === '?';
  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  const want = key.length === 1 ? key.toUpperCase() : key;
  return k === want || e.code === `Key${want}`;
}

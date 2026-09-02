import { useEffect, useRef } from 'react';
import { matchesCombo } from '../lib/keyboard';

/**
 * Global keyboard shortcuts. `bindings` is an array of { combo, handler, allowInInput? }.
 * Handlers run in the capture phase so they win over CodeMirror when needed.
 */
export function useHotkeys(bindings, deps = []) {
  const ref = useRef(bindings);
  ref.current = bindings;
  useEffect(() => {
    const onKey = (e) => {
      for (const b of ref.current) {
        if (!b.combo) continue;
        if (matchesCombo(e, b.combo)) {
          if (b.when && !b.when()) continue;
          e.preventDefault();
          e.stopPropagation();
          b.handler(e);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

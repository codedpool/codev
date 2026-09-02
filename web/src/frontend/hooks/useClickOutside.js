import { useEffect } from 'react';

export function useClickOutside(refs, handler, active = true) {
  useEffect(() => {
    if (!active) return;
    const list = Array.isArray(refs) ? refs : [refs];
    const onDown = (e) => {
      if (list.some((r) => r.current && r.current.contains(e.target))) return;
      handler(e);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [refs, handler, active]);
}

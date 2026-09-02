import { useCallback, useRef } from 'react';

/**
 * Pointer-driven resize handle. Returns props for the handle element.
 * axis: 'x' | 'y'; sign: +1 if dragging right/down grows the size, -1 otherwise.
 */
export function useResizable({ size, min, max, onChange, axis = 'x', sign = 1, onEnd }) {
  const start = useRef(null);
  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current = { pos: axis === 'x' ? e.clientX : e.clientY, size };
      document.body.classList.add(axis === 'x' ? 'is-resizing-x' : 'is-resizing-y');
    },
    [axis, size]
  );
  const onPointerMove = useCallback(
    (e) => {
      if (!start.current) return;
      const pos = axis === 'x' ? e.clientX : e.clientY;
      const delta = (pos - start.current.pos) * sign;
      const next = Math.max(min, Math.min(max, start.current.size + delta));
      onChange(next);
    },
    [axis, sign, min, max, onChange]
  );
  const onPointerUp = useCallback(
    (e) => {
      if (!start.current) return;
      start.current = null;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      document.body.classList.remove('is-resizing-x', 'is-resizing-y');
      onEnd?.();
    },
    [onEnd]
  );
  const onKeyDown = useCallback(
    (e) => {
      const step = e.shiftKey ? 40 : 10;
      const dec = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
      const inc = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
      if (e.key === dec) onChange(Math.max(min, size - step * sign));
      else if (e.key === inc) onChange(Math.min(max, size + step * sign));
      else return;
      e.preventDefault();
    },
    [axis, min, max, onChange, sign, size]
  );
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown, role: 'separator', tabIndex: 0, 'aria-orientation': axis === 'x' ? 'vertical' : 'horizontal' };
}

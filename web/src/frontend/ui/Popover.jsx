'use client';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computePosition } from './position';

/** Anchored floating panel (non-modal). Closes on outside click / Escape. */
export default function Popover({ open, anchor, onClose, placement = 'bottom', align = 'start', width, children, className = '', style }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !ref.current || !anchor) return;
    const rect = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
    const box = ref.current.getBoundingClientRect();
    setPos(computePosition(rect, { width: box.width, height: box.height }, { placement, align, offset: 6 }));
  }, [open, anchor, placement, align, children]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !(anchor instanceof Element && anchor.contains(e.target))) onClose?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;
  return createPortal(
    <div ref={ref} className={`cv-popover ${className}`} style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, '--origin': pos?.origin, ...style }} role="dialog">
      {children}
    </div>,
    document.body
  );
}

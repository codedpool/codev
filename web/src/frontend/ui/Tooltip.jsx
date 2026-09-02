'use client';
import React, { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computePosition } from './position';
import Kbd from './Kbd';

// Shared "warm" state: once a tooltip has shown, siblings appear instantly for a short while.
let lastHide = 0;

/**
 * Lightweight, keyboard-accessible tooltip.
 * <Tooltip content="Run" shortcut="Mod+Enter" side="bottom"><button/></Tooltip>
 */
export default function Tooltip({ content, shortcut, description, side = 'bottom', align = 'center', delay = 450, children, disabled }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);
  const tipRef = useRef(null);
  const timer = useRef(null);
  const reactId = useId();
  const id = useRef(`tip-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`);

  const show = useCallback(() => {
    if (disabled || !content) return;
    clearTimeout(timer.current);
    const warm = Date.now() - lastHide < 350;
    timer.current = setTimeout(() => setOpen(true), warm ? 40 : delay);
  }, [content, delay, disabled]);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen((o) => {
      if (o) lastHide = Date.now();
      return false;
    });
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tipRef.current) return;
    const a = anchorRef.current.getBoundingClientRect();
    const t = tipRef.current.getBoundingClientRect();
    setPos(computePosition(a, { width: t.width, height: t.height }, { placement: side, align, offset: 7 }));
  }, [open, side, align, content]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => hide();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onScroll, true);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onScroll, true);
    };
  }, [open, hide]);

  const child = React.Children.only(children);
  const merged = cloneElement(child, {
    ref: (node) => {
      anchorRef.current = node;
      const r = child.ref;
      if (typeof r === 'function') r(node);
      else if (r) r.current = node;
    },
    'aria-describedby': open ? id.current : child.props['aria-describedby'],
    onPointerEnter: (e) => { child.props.onPointerEnter?.(e); show(); },
    onPointerLeave: (e) => { child.props.onPointerLeave?.(e); hide(); },
    onPointerDown: (e) => { child.props.onPointerDown?.(e); hide(); },
    onFocus: (e) => { child.props.onFocus?.(e); if (e.target.matches(':focus-visible')) show(); },
    onBlur: (e) => { child.props.onBlur?.(e); hide(); },
  });

  return (
    <>
      {merged}
      {open && content
        ? createPortal(
            <div
              ref={tipRef}
              id={id.current}
              role="tooltip"
              className="cv-tooltip"
              style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, zIndex: 'var(--z-popover)', pointerEvents: 'none', animation: 'cv-pop var(--dur-2) var(--ease)', transformOrigin: pos?.origin }}
            >
              <span>{content}</span>
              {description ? <span className="cv-tooltip__desc">{description}</span> : null}
              {shortcut ? <Kbd combo={shortcut} /> : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

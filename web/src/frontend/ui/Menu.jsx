'use client';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { computePosition, pointRect } from './position';
import Kbd from './Kbd';

/**
 * Menu — a positioned list of actions with full keyboard support.
 * items: [{ id?, label, icon, shortcut, hint, onSelect, disabled, danger, checked, separator, title }]
 * anchor: DOMRect | {x,y} | HTMLElement
 */
export function Menu({ open, anchor, items = [], onClose, placement = 'bottom', align = 'start', minWidth, restoreFocusTo }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const [focus, setFocus] = useState(-1);

  const hasIcons = items.some((it) => it.icon);
  const enabled = useMemo(() => items.map((it, i) => (!it.separator && !it.title && !it.disabled ? i : -1)).filter((i) => i >= 0), [items]);

  useLayoutEffect(() => {
    if (!open || !ref.current || !anchor) return;
    const rect = anchor instanceof Element ? anchor.getBoundingClientRect() : 'x' in anchor ? pointRect(anchor.x, anchor.y) : anchor;
    const box = ref.current.getBoundingClientRect();
    setPos(computePosition(rect, { width: box.width, height: box.height }, { placement, align, offset: 'x' in (anchor || {}) ? 2 : 4 }));
  }, [open, anchor, placement, align, items.length]);

  useEffect(() => {
    if (!open) { setFocus(-1); return; }
    const restoreEl = restoreFocusTo?.current;
    const t = setTimeout(() => ref.current?.focus({ preventScroll: true }), 0);
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    const onScroll = () => onClose?.();
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onScroll);
    window.addEventListener('blur', onScroll);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('blur', onScroll);
      restoreEl?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, restoreFocusTo]);

  const select = useCallback(
    (item) => {
      if (!item || item.disabled) return;
      onClose?.();
      // Run after close so the menu unmounts before side effects (dialogs, focus).
      setTimeout(() => item.onSelect?.(), 0);
    },
    [onClose]
  );

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!enabled.length) return;
      const cur = enabled.indexOf(focus);
      const next = e.key === 'ArrowDown' ? enabled[(cur + 1) % enabled.length] : enabled[(cur - 1 + enabled.length) % enabled.length];
      setFocus(next);
      return;
    }
    if (e.key === 'Home') { setFocus(enabled[0] ?? -1); e.preventDefault(); return; }
    if (e.key === 'End') { setFocus(enabled[enabled.length - 1] ?? -1); e.preventDefault(); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (focus >= 0) select(items[focus]); return; }
    // type-ahead
    if (e.key.length === 1 && /\S/.test(e.key)) {
      const k = e.key.toLowerCase();
      const start = enabled.indexOf(focus) + 1;
      for (let n = 0; n < enabled.length; n++) {
        const idx = enabled[(start + n) % enabled.length];
        if ((items[idx].label || '').toLowerCase().startsWith(k)) { setFocus(idx); break; }
      }
    }
  };

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      className="cv-menu"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, minWidth, '--origin': pos?.origin }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => {
        if (it.separator) return <div key={`sep-${i}`} className="cv-menu__sep" role="separator" />;
        if (it.title) return <div key={`t-${i}`} className="cv-menu__title">{it.title}</div>;
        return (
          <button
            key={it.id || it.label || i}
            type="button"
            role="menuitem"
            aria-disabled={it.disabled || undefined}
            className={`cv-menu__item ${it.danger ? 'cv-menu__item--danger' : ''} ${focus === i ? 'is-focused' : ''}`}
            onPointerEnter={() => setFocus(i)}
            onPointerLeave={() => setFocus(-1)}
            onClick={() => select(it)}
            tabIndex={-1}
          >
            {it.checked !== undefined ? <span className="cv-menu__check">{it.checked ? <Check /> : null}</span> : null}
            {it.icon ? <span className="cv-menu__icon">{it.icon}</span> : hasIcons ? <span className="cv-menu__icon" aria-hidden /> : null}
            <span className="cv-menu__label">{it.label}</span>
            {it.hint ? <span className="cv-menu__hint">{it.hint}</span> : null}
            {it.shortcut ? <Kbd combo={it.shortcut} /> : null}
          </button>
        );
      })}
    </div>,
    document.body
  );
}

/** Hook: right-click / button-triggered menu state */
export function useMenu() {
  const [state, setState] = useState({ open: false, anchor: null, data: null });
  const openAt = useCallback((anchorOrEvent, data) => {
    if (anchorOrEvent && typeof anchorOrEvent.preventDefault === 'function') {
      anchorOrEvent.preventDefault();
      anchorOrEvent.stopPropagation();
      if (anchorOrEvent.type === 'contextmenu' || anchorOrEvent.clientX != null && anchorOrEvent.button === 2) {
        setState({ open: true, anchor: { x: anchorOrEvent.clientX, y: anchorOrEvent.clientY }, data });
        return;
      }
      setState({ open: true, anchor: anchorOrEvent.currentTarget, data });
      return;
    }
    setState({ open: true, anchor: anchorOrEvent, data });
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  return { ...state, openAt, close };
}

/** Dropdown: trigger renders with (props) → element; menu opens under it */
export function Dropdown({ items, children, placement = 'bottom', align = 'start', minWidth }) {
  const menu = useMenu();
  const triggerRef = useRef(null);
  return (
    <>
      {children({
        ref: triggerRef,
        onClick: (e) => (menu.open ? menu.close() : menu.openAt(e.currentTarget)),
        'aria-haspopup': 'menu',
        'aria-expanded': menu.open,
      })}
      <Menu open={menu.open} anchor={menu.anchor} items={items} onClose={menu.close} placement={placement} align={align} minWidth={minWidth} restoreFocusTo={triggerRef} />
    </>
  );
}

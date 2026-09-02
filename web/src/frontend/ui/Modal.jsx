'use client';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';

const FOCUSABLE = 'input, textarea, select, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog. Focus is moved inside on open and restored on close; Escape closes; Tab is trapped.
 */
export default function Modal({ open, onClose, title, description, size, children, footer, initialFocus, closeOnBackdrop = true, hideClose }) {
  const ref = useRef(null);
  const lastActive = useRef(null);

  useEffect(() => {
    if (!open) return;
    lastActive.current = document.activeElement;
    const t = setTimeout(() => {
      // Focus an explicit target if given; otherwise the dialog itself (so the close button doesn't light up).
      const target = initialFocus?.current || ref.current?.querySelector('[data-autofocus]') || ref.current;
      target?.focus?.({ preventScroll: true });
      if (target?.select && target.tagName === 'INPUT') target.select();
    }, 10);
    return () => {
      clearTimeout(t);
      lastActive.current?.focus?.({ preventScroll: true });
    };
  }, [open, initialFocus]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
    if (e.key === 'Tab' && ref.current) {
      const nodes = Array.from(ref.current.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  return createPortal(
    <div className="cv-modal-backdrop" onPointerDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className={`cv-modal ${size ? `cv-modal--${size}` : ''}`} tabIndex={-1} onKeyDown={onKeyDown}>
        {title ? (
          <div className="cv-modal__head">
            <div className="cv-modal__title">{title}</div>
            {!hideClose ? <IconButton label="Close" size="sm" onClick={onClose} tooltipDisabled><X /></IconButton> : null}
          </div>
        ) : null}
        {description ? <div className="cv-modal__desc">{description}</div> : null}
        <div className="cv-modal__body">{children}</div>
        {footer ? <div className="cv-modal__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

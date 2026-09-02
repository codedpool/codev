'use client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, Sparkles, X, XCircle } from 'lucide-react';
import { Button, IconButton } from './Button';

const ToastCtx = createContext(null);
const ICONS = { success: CheckCircle2, error: XCircle, warn: AlertTriangle, info: Info, ai: Sparkles };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 180);
  }, []);

  const toast = useCallback(
    ({ title, description, kind = 'info', duration, actions, id: givenId }) => {
      const id = givenId || `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
      setToasts((ts) => {
        const rest = ts.filter((t) => t.id !== id).slice(-3);
        return [...rest, { id, title, description, kind, actions }];
      });
      const ms = duration ?? (kind === 'error' ? 7000 : 4000);
      clearTimeout(timers.current.get(id));
      if (ms > 0) timers.current.set(id, setTimeout(() => dismiss(id), ms));
      return id;
    },
    [dismiss]
  );

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {mounted && createPortal(
        <div className="cv-toasts" aria-live="polite" aria-relevant="additions">
          {toasts.map((t) => {
            const Icon = ICONS[t.kind] || Info;
            return (
              <div key={t.id} className={`cv-toast cv-toast--${t.kind} ${t.leaving ? 'is-leaving' : ''}`} role="status">
                <span className="cv-toast__icon"><Icon /></span>
                <div className="cv-toast__body">
                  <div className="cv-toast__title">{t.title}</div>
                  {t.description ? <div className="cv-toast__desc">{t.description}</div> : null}
                  {t.actions?.length ? (
                    <div className="cv-toast__actions">
                      {t.actions.map((a, i) => (
                        <Button key={i} size="sm" variant={a.variant || (i === 0 ? 'secondary' : 'ghost')} onClick={() => { a.onClick?.(); if (a.dismiss !== false) dismiss(t.id); }}>
                          {a.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <IconButton label="Dismiss" size="sm" className="cv-toast__close" onClick={() => dismiss(t.id)} tooltipDisabled><X /></IconButton>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

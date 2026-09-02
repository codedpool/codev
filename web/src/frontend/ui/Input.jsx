'use client';
import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export const Input = forwardRef(function Input({ icon, trailing, size, mono, bare, invalid, className = '', style, ...rest }, ref) {
  return (
    <label className={`cv-input ${size ? `cv-input--${size}` : ''} ${mono ? 'cv-input--mono' : ''} ${bare ? 'cv-input--bare' : ''} ${invalid ? 'is-invalid' : ''} ${className}`} style={style}>
      {icon ? <span className="cv-input__icon">{icon}</span> : null}
      <input ref={ref} {...rest} />
      {trailing ? <span className="cv-input__trail">{trailing}</span> : null}
    </label>
  );
});

export const Textarea = forwardRef(function Textarea({ mono, className = '', ...rest }, ref) {
  return <textarea ref={ref} className={`cv-textarea ${mono ? 'cv-textarea--mono' : ''} ${className}`} {...rest} />;
});

export function Field({ label, hint, error, htmlFor, children, row }) {
  return (
    <div className="cv-field">
      {label ? <label className="cv-field__label" htmlFor={htmlFor}>{label}</label> : null}
      {row ? <div className="cv-field__row">{children}</div> : children}
      {error ? <div className="cv-field__error" role="alert">{error}</div> : hint ? <div className="cv-field__hint">{hint}</div> : null}
    </div>
  );
}

export const Select = forwardRef(function Select({ size, className = '', style, children, ...rest }, ref) {
  return (
    <span className={`cv-select ${size ? `cv-select--${size}` : ''} ${className}`} style={style}>
      <select ref={ref} {...rest}>{children}</select>
      <span className="cv-select__chev"><ChevronDown /></span>
    </span>
  );
});

export function Switch({ checked, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="cv-switch" disabled={disabled} onClick={() => onChange?.(!checked)} />
  );
}

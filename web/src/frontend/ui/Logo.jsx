'use client';
import React from 'react';

/** Codev mark: two brackets that meet at a lime "presence" dot. */
export function LogoMark({ size = 18, className = '' }) {
  return (
    <svg className={`cv-logo__mark ${className}`} width={size} height={size} style={{ width: size, height: size }} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#15181d" stroke="rgba(255,255,255,0.12)" />
      <path d="M9.5 7.5 5.5 12l4 4.5" stroke="#e8eaef" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 7.5l4 4.5-4 4.5" stroke="#e8eaef" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1.7" fill="#c8f04a" />
    </svg>
  );
}

export default function Logo({ word = true, size = 18, className = '' }) {
  return (
    <span className={`cv-logo ${className}`}>
      <LogoMark size={size} />
      {word ? (
        <span className="cv-logo__word">
          codev<b>.</b>
        </span>
      ) : null}
    </span>
  );
}

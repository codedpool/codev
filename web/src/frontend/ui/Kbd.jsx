'use client';
import React from 'react';
import { shortcutParts } from '../lib/keyboard';

export default function Kbd({ combo, keys, className = '' }) {
  const parts = keys || shortcutParts(combo);
  if (!parts.length) return null;
  return (
    <span className={`cv-kbd ${className}`} aria-label={parts.join(' ')}>
      {parts.map((p, i) => (
        <kbd key={i} className="cv-kbd__key">{p}</kbd>
      ))}
    </span>
  );
}

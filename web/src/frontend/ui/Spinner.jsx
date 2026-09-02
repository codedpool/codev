'use client';
import React from 'react';
export default function Spinner({ size = 'md', className = '' }) {
  return <span className={`cv-spinner ${size === 'lg' ? 'cv-spinner--lg' : ''} ${className}`} role="progressbar" aria-label="Loading" />;
}

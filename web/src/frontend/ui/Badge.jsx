'use client';
import React from 'react';
export default function Badge({ tone, count, mono, className = '', children, ...rest }) {
  return (
    <span className={`cv-badge ${tone ? `cv-badge--${tone}` : ''} ${count ? 'cv-badge--count' : ''} ${mono ? 'cv-badge--mono' : ''} ${className}`} {...rest}>
      {children}
    </span>
  );
}
export function Dot({ tone, pulse, className = '', style }) {
  return <span className={`cv-dot ${tone ? `cv-dot--${tone}` : ''} ${pulse ? 'cv-dot--pulse' : ''} ${className}`} style={style} aria-hidden />;
}
export function Chip({ ai, icon, className = '', children, ...rest }) {
  const Tag = rest.onClick ? 'button' : 'span';
  return (
    <Tag type={Tag === 'button' ? 'button' : undefined} className={`cv-chip ${ai ? 'cv-chip--ai' : ''} ${className}`} {...rest}>
      {icon}
      {children}
    </Tag>
  );
}

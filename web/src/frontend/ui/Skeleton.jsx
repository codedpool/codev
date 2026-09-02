'use client';
import React from 'react';
export default function Skeleton({ width = '100%', height, circle, className = '', style }) {
  return (
    <span
      className={`cv-skel ${circle ? 'cv-skel--circle' : ''} ${className}`}
      style={{ width, height: height ?? (circle ? width : undefined), display: 'block', ...style }}
      aria-hidden
    />
  );
}
export function SkeletonLines({ rows = 4, widths = ['70%', '92%', '55%', '80%', '64%', '88%'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} height={9} />
      ))}
    </div>
  );
}

'use client';
import React from 'react';
import { Folder, FolderOpen } from 'lucide-react';
import { fileType } from '../lib/fileTypes';

/** Compact, colour-coded file-type glyph. */
export default function FileIcon({ name, size = 'md', className = '' }) {
  const t = fileType(name);
  return (
    <span className={`ftype ${size === 'lg' ? 'ftype--lg' : size === 'sm' ? 'ftype--sm' : ''} ${className}`} style={{ '--ft-color': t.color }} aria-hidden>
      {t.glyph}
    </span>
  );
}

export function FolderIcon({ open, className = '' }) {
  const Icon = open ? FolderOpen : Folder;
  return <Icon className={className} style={{ color: open ? '#c8b26a' : '#a3915a', width: 14, height: 14 }} aria-hidden />;
}

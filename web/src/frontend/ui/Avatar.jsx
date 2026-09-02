'use client';
import React from 'react';
import { colorFor, initials } from '../lib/colors';
import Tooltip from './Tooltip';

export default function Avatar({ name = '', src, color, size = 'sm', ring, status, dim, title, className = '', style }) {
  const c = color || colorFor(name);
  const el = (
    <span
      className={`cv-avatar cv-avatar--${size} ${ring ? 'cv-avatar--ring' : ''} ${dim ? 'cv-avatar--dim' : ''} ${className}`}
      style={{ '--av-color': c, ...style }}
      aria-label={name}
      role="img"
    >
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : initials(name)}
      {status ? <span className="cv-avatar__status" /> : null}
    </span>
  );
  return title ? <Tooltip content={title}>{el}</Tooltip> : el;
}

export function AvatarStack({ users = [], max = 4, size = 'sm' }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <span className="cv-avatar-stack">
      {shown.map((u) => (
        <Avatar key={u.id} name={u.name} src={u.avatar} color={u.color} size={size} title={u.title || u.name} />
      ))}
      {rest > 0 ? <span className="cv-avatar-stack__more">+{rest}</span> : null}
    </span>
  );
}

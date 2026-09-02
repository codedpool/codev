'use client';
import React from 'react';
export default function EmptyState({ icon, title, description, actions, className = '', compact }) {
  return (
    <div className={`cv-empty ${className}`} style={compact ? { padding: '14px 12px', height: 'auto' } : undefined}>
      {icon ? <div className="cv-empty__icon">{icon}</div> : null}
      {title ? <div className="cv-empty__title">{title}</div> : null}
      {description ? <div className="cv-empty__desc">{description}</div> : null}
      {actions ? <div className="cv-empty__actions">{actions}</div> : null}
    </div>
  );
}

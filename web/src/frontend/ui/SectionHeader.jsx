'use client';
import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function SectionHeader({ title, collapsible, collapsed, onToggle, actions, actionsVisible, badge, className = '' }) {
  const Title = collapsible ? 'button' : 'div';
  return (
    <div className={`cv-section ${className}`}>
      <Title
        type={collapsible ? 'button' : undefined}
        className={`cv-section__title ${collapsed ? 'is-collapsed' : ''}`}
        onClick={collapsible ? onToggle : undefined}
        aria-expanded={collapsible ? !collapsed : undefined}
      >
        {collapsible ? <ChevronDown /> : null}
        <span className="u-truncate">{title}</span>
        {badge}
      </Title>
      {actions ? <div className={`cv-section__actions ${actionsVisible ? 'is-visible' : ''}`}>{actions}</div> : null}
    </div>
  );
}

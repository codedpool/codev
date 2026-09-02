'use client';
import React, { forwardRef } from 'react';
import Kbd from './Kbd';
import Spinner from './Spinner';
import Tooltip from './Tooltip';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Button — variants: primary | secondary | ghost | outline | danger | danger-solid | ai | ai-solid | stop
 */
export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, loading, active, block, shortcut, className, children, tooltip, tooltipShortcut, ...rest },
  ref
) {
  const btn = (
    <button
      ref={ref}
      type="button"
      className={cx('cv-btn', `cv-btn--${variant}`, size !== 'md' && `cv-btn--${size}`, block && 'cv-btn--block', active && 'is-active', loading && 'is-loading', className)}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon ? <span className="cv-btn__icon">{icon}</span> : null}
      {children ? <span>{children}</span> : null}
      {iconRight ? <span className="cv-btn__icon">{iconRight}</span> : null}
      {shortcut ? <span className="cv-btn__kbd"><Kbd combo={shortcut} /></span> : null}
    </button>
  );
  if (tooltip) return <Tooltip content={tooltip} shortcut={tooltipShortcut}>{btn}</Tooltip>;
  return btn;
});

export const IconButton = forwardRef(function IconButton(
  { label, shortcut, size = 'md', active, tone, className, children, side = 'bottom', tooltipDisabled, ...rest },
  ref
) {
  const btn = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active !== undefined ? active : undefined}
      className={cx('cv-iconbtn', size !== 'md' && `cv-iconbtn--${size}`, tone && `cv-iconbtn--${tone}`, active && 'is-active', className)}
      {...rest}
    >
      {children}
    </button>
  );
  if (!label || tooltipDisabled) return btn;
  return (
    <Tooltip content={label} shortcut={shortcut} side={side}>
      {btn}
    </Tooltip>
  );
});

export default Button;

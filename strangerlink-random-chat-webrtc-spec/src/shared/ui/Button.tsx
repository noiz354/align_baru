/**
 * Button component — real implementation.
 *
 * Requirements:
 * - NFR-A11Y-001, NFR-A11Y-003
 * - T-A11Y-121
 * - ACCESSIBILITY.md, DESIGN.md §18
 */

import React from 'react';

export interface ButtonProps {
  label: string;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size: 'default' | 'critical';
  disabled?: boolean;
  pressed?: boolean;
  type?: 'button' | 'submit';
  ariaLabel?: string;
  className?: string;
}

export const MIN_TOUCH_TARGET_PX = 44;
export const MIN_CRITICAL_TOUCH_TARGET_PX = 56;

export function Button(props: ButtonProps): React.JSX.Element {
  const {
    label,
    onClick,
    variant,
    size,
    disabled,
    pressed,
    type = 'button',
    ariaLabel,
    className,
  } = props;

  const baseStyle: React.CSSProperties = {
    minWidth: size === 'critical' ? MIN_CRITICAL_TOUCH_TARGET_PX : MIN_TOUCH_TARGET_PX,
    minHeight: size === 'critical' ? MIN_CRITICAL_TOUCH_TARGET_PX : MIN_TOUCH_TARGET_PX,
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    fontSize: '16px',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s ease',
  };

  const variantStyle: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: '#111827', color: 'white' },
    secondary: { backgroundColor: '#E5E7EB', color: '#111827' },
    danger: { backgroundColor: '#DC2626', color: 'white' },
    ghost: { backgroundColor: 'transparent', color: '#111827', border: '1px solid #D1D5DB' },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || label}
      aria-pressed={pressed}
      aria-disabled={disabled}
      style={{ ...baseStyle, ...variantStyle[variant] }}
      className={className}
    >
      {label}
    </button>
  );
}

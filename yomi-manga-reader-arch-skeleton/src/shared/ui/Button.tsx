'use client';

/**
 * Button — the shared action primitive.
 *
 * Requirements: NFR-A11Y-006 (visible focus), NFR-A11Y-010 (≥ 44×44 px
 * target). Task: T-FOUND-004.
 *
 * A native `<button>` on purpose (WCAG 2.1 SC 4.1.2 — role and keyboard
 * behaviour come free with the element; a `div` with a click handler would
 * have to re-implement Enter, Space and the disabled semantics). It is a
 * client component because it accepts an action; the element, its variants
 * and its focus behaviour are the whole contract.
 *
 * A DOCUMENTED SKELETON: variants and states only.
 * TODO(T-CATALOG-003/004, T-ADMIN-002, T-AUTH-012): pending/loading state
 * and the double-submit guard belong to the feature that owns the form, not
 * to the primitive.
 *
 * Token references: base.css `.btn` (--bg-surface, --ink-primary,
 * --line-control), `.btn--primary` (--accent-* , --ink-on-accent),
 * `:focus-visible` + `.btn--primary:focus-visible` (--focus-outer,
 * --focus-inner).
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'default' | 'primary';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary` is the single vermilion action on a surface; one per view. */
  variant?: ButtonVariant;
  children: ReactNode;
};

export function Button({
  variant = 'default',
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = ['btn'];
  if (variant === 'primary') classes.push('btn--primary');
  if (className) classes.push(className);

  return (
    <button type={type} className={classes.join(' ')} {...rest}>
      {children}
    </button>
  );
}

export default Button;

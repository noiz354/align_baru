/**
 * Link — the shared link primitive.
 *
 * Requirements: NFR-A11Y-006 (visible focus), NFR-A11Y-010 (target size).
 * Task: T-FOUND-004 (shared UI foundation).
 *
 * Why this exists: a link in this product has one job (navigate) and one
 * obligation (be visibly focusable and big enough to hit). Making that a
 * primitive is what stops every feature from re-deriving the class list, and
 * it is why the shell's nav can be walked with a keyboard today.
 *
 * A DOCUMENTED SKELETON: it renders the element and its token classes. It
 * does not decide where a link goes — that is the caller's route map — and it
 * carries no state. Server component: no hooks, so any page may use it.
 *
 * Token references: base.css `a` (--link-ink, --line-control),
 * `.shell-nav a`, `.admin-nav a`, `:focus-visible` (--focus-outer).
 */
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/** next/link's own props, so the wrapper can never narrow or widen them. */
type NextLinkProps = ComponentProps<typeof Link>;

export type UiLinkProps = Omit<NextLinkProps, 'href' | 'className'> & {
  /** A route in the planned route map, or a same-origin path. */
  href: string;
  children: ReactNode;
  /**
   * Extra class for the surface the link sits on (`.shell-nav` and
   * `.admin-nav` supply their own). Never used to carry a colour.
   */
  className?: string;
};

export function UiLink({ href, children, className, ...rest }: UiLinkProps) {
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}

export default UiLink;

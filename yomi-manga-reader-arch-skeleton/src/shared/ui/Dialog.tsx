'use client';

/**
 * Dialog — a modal built on the native `<dialog>` element.
 *
 * Requirements: NFR-A11Y-003 (focus management), NFR-A11Y-006 (visible
 * focus), NFR-A11Y-010 (target size). Task: T-FOUND-004.
 *
 * WHY THE NATIVE ELEMENT: `showModal()` gives the top layer, the focus trap,
 * the inert background and Escape-to-close from the platform, all of which
 * are the parts that are easy to get wrong by hand (WCAG 2.1 SC 2.1.2 no
 * keyboard trap, SC 2.4.3 focus order). A hand-rolled trap is the usual
 * source of regressions, so the product does not carry one.
 *
 * State contract: `open` is the single source of truth. Opening calls
 * showModal(), closing calls close(), and the native `close` event is
 * reported through `onClose` so a parent that closed the dialog another way
 * (a confirm button, a route change) stays in sync.
 *
 * A DOCUMENTED SKELETON: the frame, the labelling and the trap.
 * TODO(T-ADMIN-002, T-LIB-008, T-READER-028): destructive confirmations and
 * the reader's chrome dialogs are the owning tasks. Two behaviours belong to
 * the CALLER and are not done here: returning focus to the trigger on close
 * (SC 2.4.3), and a pending action that must not close the dialog until the
 * server confirms.
 *
 * Token references: base.css `.dialog` (--bg-surface, --ink-primary,
 * --line-control), `.dialog::backdrop` (--bg-chrome), `.btn`.
 */
import { useEffect, useRef, type ReactNode } from 'react';

export type DialogProps = {
  open: boolean;
  /** Called when the dialog closes, however it closed (Escape included). */
  onClose: () => void;
  /** Visible title; also the dialog's accessible name. */
  title: string;
  children: ReactNode;
  /** Actions (confirm/cancel). Focus order: first action is focused on open. */
  actions?: ReactNode;
  /** Caller-generated id prefix; defaults to `dialog`. */
  idPrefix?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  idPrefix = 'dialog',
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `${idPrefix}-title`;

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    if (open && !node.open) {
      // showModal() is what installs the focus trap; the `open` attribute
      // alone would render the dialog non-modally with no trap at all.
      if (typeof node.showModal === 'function') node.showModal();
      else node.setAttribute('open', '');
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    const handleClose = () => onClose();
    node.addEventListener('close', handleClose);
    return () => node.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog className="dialog" ref={ref} aria-labelledby={titleId}>
      <div className="dialog__head">
        <h2 id={titleId}>{title}</h2>
      </div>
      <div className="dialog__body">{children}</div>
      {actions === undefined ? null : <div className="dialog__foot">{actions}</div>}
    </dialog>
  );
}

export default Dialog;

/**
 * FormField — label, control, hint and error, wired for assistive tech.
 *
 * Requirements: NFR-A11Y-001 (WCAG 2.1 AA), NFR-A11Y-006 (visible focus),
 * NFR-A11Y-010 (target size). Task: T-FOUND-004.
 *
 * ACCESSIBILITY.md §5 is the contract this primitive exists to satisfy:
 *   - every input has a VISIBLE label (no placeholder-as-label);
 *   - helper text and the error message are linked with aria-describedby;
 *   - an error is announced (role="alert") and the control is marked
 *     aria-invalid, so the failure is never carried by colour alone
 *     (ACCESSIBILITY.md §3.3);
 *   - `required` is announced natively, and the browser's own validation UI
 *     is left switched on (no `noValidate` here).
 *
 * A DOCUMENTED SKELETON: the wiring, not the validation. The form that owns
 * a field decides when it is invalid and what the message says; this
 * component only renders the state it is handed.
 * TODO(T-AUTH-012, T-READER-018, T-SEARCH-004): radio groups and checkboxes
 * need a fieldset/legend variant, and the search field needs the
 * `type="search"` + Enter-forces-search behaviour of FR-SEARCH-005.
 *
 * `id` is required rather than generated: forms own their id scheme (server
 * errors arrive keyed by field name), and a generated id would be unstable
 * across the SSR/hydration boundary for anything server-rendered.
 *
 * Token references: base.css `.field`, `.field__hint` (--ink-muted),
 * `.field__error` (--danger-ink), `input[aria-invalid='true']`.
 */
import type { InputHTMLAttributes, ReactNode } from 'react';

export type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'children'> & {
  /** The control's id, and the `for` target of the visible label. */
  id: string;
  /** Visible label text. Required: a placeholder is not a label. */
  label: ReactNode;
  /** Helper text, linked with aria-describedby. */
  hint?: ReactNode;
  /** Inline error, announced and linked; also sets aria-invalid. */
  error?: ReactNode;
};

export function FormField({ id, label, hint, error, className, ...rest }: FormFieldProps) {
  const hintId = hint === undefined ? undefined : `${id}-hint`;
  const errorId = error === undefined ? undefined : `${id}-error`;

  // aria-describedby takes every id that applies, hint first: the helper
  // text explains the field, the error corrects it.
  const describedBy = [hintId, errorId].filter((value) => value !== undefined).join(' ');

  const classes = ['field'];
  if (className) classes.push(className);

  return (
    <div className={classes.join(' ')}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        {...rest}
      />
      {hint === undefined ? null : (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default FormField;

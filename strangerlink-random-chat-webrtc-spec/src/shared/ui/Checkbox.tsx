/**
 * Checkbox component shell.
 *
 * Requirements:
 * - FR-ENTRY-002 (affirmative gate)
 * - FR-ENTRY-007 (keyboard operable, screen-reader labelled)
 * - NFR-A11Y-001
 *
 * See:
 * - docs/safety/AGE-GATING.md §1
 * - ACCESSIBILITY.md §1
 *
 * COMPONENT SHELL ONLY.
 */

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  describedBy?: string;
  disabled?: boolean;
}

/**
 * TODO(T-SESSION-002): implement the checkbox.
 *
 * When implemented it must:
 * - render a native <input type="checkbox"> with an associated label
 * - default to UNCHECKED (FR-ENTRY-002)
 * - support `aria-describedby` for the disclaimer text
 * - be operable with Space and focusable with Tab
 */
export function Checkbox(_props: CheckboxProps): React.JSX.Element {
  throw new Error('Not implemented: T-SESSION-002 (Checkbox component shell)');
}

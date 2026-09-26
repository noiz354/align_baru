/**
 * Button component shell.
 *
 * Requirements:
 * - NFR-A11Y-001 (WCAG 2.2 AA)
 * - NFR-A11Y-003 (touch target sizes)
 *
 * See:
 * - ACCESSIBILITY.md §1, §7
 * - DESIGN.md §18
 *
 * COMPONENT SHELL ONLY.
 */

export interface ButtonProps {
  label: string;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** ≥ 44px; critical controls use 'critical' for ≥ 56px. */
  size: 'default' | 'critical';
  disabled?: boolean;
  /** Required for toggle buttons. */
  pressed?: boolean;
}

/**
 * Minimum touch target sizes. See ACCESSIBILITY.md §7.
 */
export const MIN_TOUCH_TARGET_PX = 44;
export const MIN_CRITICAL_TOUCH_TARGET_PX = 56;

/**
 * TODO(T-A11Y-121): implement the button.
 *
 * When implemented it must:
 * - render a native <button>
 * - expose a visible focus indicator at ≥ 3:1 contrast
 * - carry `aria-pressed` when `pressed` is provided
 * - meet the minimum touch target size
 * - be operable by keyboard alone
 */
export function Button(_props: ButtonProps): React.JSX.Element {
  throw new Error('Not implemented: T-A11Y-121 (Button component shell)');
}

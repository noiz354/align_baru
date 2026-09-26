/**
 * Live region component shell.
 *
 * Requirements:
 * - NFR-A11Y-005 (announce session state changes)
 *
 * See:
 * - ACCESSIBILITY.md §2, §9
 *
 * COMPONENT SHELL ONLY.
 */

export interface LiveRegionProps {
  message: string;
  politeness: 'polite' | 'assertive';
}

/** Debounce window for rapid successive state changes. See ACCESSIBILITY.md §9. */
export const ANNOUNCEMENT_DEBOUNCE_MS = 1000;

/**
 * TODO(T-A11Y-121): implement the live region.
 *
 * When implemented it must:
 * - use a SINGLE polite region for the application, not one per component
 * - debounce rapid successive changes so a screen reader is not flooded
 * - never announce every chat message — summarise at intervals instead
 * - announce the reason CLASS of an error, never a raw error string
 */
export function LiveRegion(_props: LiveRegionProps): React.JSX.Element {
  throw new Error('Not implemented: T-A11Y-121 (LiveRegion component shell)');
}

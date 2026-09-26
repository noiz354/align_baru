/**
 * Sheet component shell — used for the report and block panels.
 *
 * Requirements:
 * - FR-REPORT-001 (report reachable)
 * - NFR-A11Y-001 (focus management)
 *
 * See:
 * - ACCESSIBILITY.md §4
 * - docs/safety/REPORTING.md §3
 *
 * COMPONENT SHELL ONLY.
 */

export interface SheetProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * TODO(T-REPORT-006): implement the sheet.
 *
 * When implemented it must:
 * - move focus to the sheet on open and return it to the trigger on close
 * - trap focus while open
 * - close on Escape
 * - make the background inert
 *
 * CRITICAL: opening the report sheet must NOT end the session. Only
 * submitting the report does. See docs/safety/REPORTING.md §4.
 */
export function Sheet(_props: SheetProps): React.JSX.Element {
  throw new Error('Not implemented: T-REPORT-006 (Sheet component shell)');
}

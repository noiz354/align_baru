// HomeOps - feature skeleton (specification phase). Presentation shell only.

/**
 * Mode-aware level control (docs/design/INTERACTION-PATTERNS.md section 3).
 * Contract:
 *  - EXACT: [Used one] shortcut plus an optional small stepper; APPROXIMATE: Full/Enough/Low/Empty;
 *    binary: Available/None;
 *  - no slider, no required numeric typing, keyboard operable as one labelled control, >= 44 px targets;
 *  - announces the item and the new level ("Toilet paper: low"), never a bare colour.
 * Implemented in T-RES-013.
 */

export type LevelPickerProps = {
  readonly resourceId: string;
  readonly resourceName: string;
  readonly mode: 'EXACT' | 'APPROXIMATE' | 'AVAILABLE_UNAVAILABLE';
  readonly onSelect?: (choice: string) => void;
};

export function LevelPicker(_props: LevelPickerProps) {
  return null;
}

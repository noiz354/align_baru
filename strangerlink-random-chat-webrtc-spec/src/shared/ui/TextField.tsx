/**
 * Text field component shell.
 *
 * Requirements:
 * - FR-CHAT-003 (message length)
 * - NFR-A11Y-001
 *
 * See:
 * - ACCESSIBILITY.md §1, §2
 *
 * COMPONENT SHELL ONLY.
 */

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  /** Show the character counter only at this threshold. */
  counterThreshold?: number;
  multiline?: boolean;
}

/** TODO(T-CHAT-001): implement the text field. */
export function TextField(_props: TextFieldProps): React.JSX.Element {
  throw new Error('Not implemented: T-CHAT-001 (TextField component shell)');
}

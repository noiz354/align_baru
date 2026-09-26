/**
 * Settings (`/settings`) route shell — authenticated.
 *
 * Requirements: FR-READER-021 (reader prefs), FR-AUTH-005 (account
 * deletion), FR-AUTH-004 (password — VS-9).
 * Tasks: T-READER-018 (reader prefs section), T-AUTH-011 (deletion UI).
 *
 * Behavior: reader preferences form (defaultMode, directionOverride,
 * zoomDefault, autoNextChannel — labeled fields, a11y per
 * ACCESSIBILITY.md §5); account section (password change, delete account
 * with confirm). No feature code in this phase.
 */
export default function SettingsPage() {
  return (
    <main>
      {/* TODO(T-READER-018): reader preferences form */}
      {/* TODO(T-AUTH-011): account section (password, delete) */}
    </main>
  );
}

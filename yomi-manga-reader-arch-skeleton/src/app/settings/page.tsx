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
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 6: reader preferences are
 * features/reader (prefs), served by `src/app/api/v1/preferences/route.ts`;
 * the account section is features/auth (§5 row 5).
 *
 * The preference form is where the fieldset/legend pattern applies — radio
 * groups for mode, direction and channel (ACCESSIBILITY.md §5, §3.1) — which
 * the FormField primitive does not yet cover.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function SettingsPage() {
  return (
    <>
      <h1>Settings</h1>
      {/* TODO(T-READER-018): reader preferences form */}
      {/* TODO(T-AUTH-011): account section (password, delete) */}
    </>
  );
}

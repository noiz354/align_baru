/**
 * Root layout (route shell — T-FOUND-003).
 *
 * Requirements: NFR-A11Y-004 (landmarks), FR-CATALOG-006 (route map).
 * Task: T-FOUND-003.
 *
 * Contract: AppShell (landmarks + skip link) wraps all pages; metadata
 * contract per route (title template "%s · Yomi"); no feature code here.
 * TODO(T-FOUND-003): wire AppShell + metadata + font/theme tokens.
 */
import type { ReactNode } from 'react';
import AppShell from '../shared/ui/AppShell';

export default function RootLayout({ children }: { children: ReactNode }) {
  // TODO(T-FOUND-003): metadata, theme tokens, AppShell chrome (header/footer).
  return (
    <AppShell>
      {children}
    </AppShell>
  );
}

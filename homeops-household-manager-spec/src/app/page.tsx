// HomeOps — root page (T-PLAT-002, docs/design/PAGES.md).
//
// VS-0 ships no product feature and no session, so the only honest destination is the sign-in
// shell. T-HH-003 (VS-1) replaces this redirect with session/membership-aware routing:
// member → /today, signed-in without household → /onboarding, anonymous → /sign-in.

import { redirect } from 'next/navigation';

export default function RootPage(): never {
  redirect('/sign-in');
}

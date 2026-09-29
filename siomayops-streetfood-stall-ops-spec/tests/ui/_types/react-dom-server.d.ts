/**
 * Minimal ambient type for `react-dom/server`.
 *
 * `@types/react-dom` is not a dependency of this project (see `package.json`), and adding one would
 * also require regenerating `pnpm-lock.yaml`. The UI integration tests need exactly one function
 * from that module — the server renderer used to assert what a Server Component renders — so only
 * that function is declared, keeping `npm run typecheck` green without a new dependency.
 *
 * If `@types/react-dom` is ever added, this file should be deleted in favour of the real types.
 */
declare module "react-dom/server" {
  import type { ReactElement } from "react";
  export function renderToStaticMarkup(element: ReactElement): string;
}

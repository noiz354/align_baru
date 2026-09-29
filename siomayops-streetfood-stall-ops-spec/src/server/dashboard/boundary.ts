/**
 * Authenticated server boundary for the HQ dashboard (T-HQ-003 integration step).
 *
 * Documented in `docs/integration/04-dashboard-ui-integration.md`.
 *
 * This is the only door between the dashboard surface and the read model:
 *
 *   page / route handler
 *     → loadHqDashboard()            ← session, authorization, filter validation
 *       → getHqDashboardReadModel()  ← aggregation over persisted facts
 *         → persistence
 *
 * Guarantees:
 *  - authentication comes from the project's existing auth port (`createAuthPort`) — there is
 *    no second auth flow;
 *  - authorization is the existing `hq:view` action, evaluated against the organization scope;
 *  - the area/outlet narrowing is applied server-side, so an out-of-scope outlet filter is
 *    rejected (`INVALID_FILTER`) instead of silently returning organization-wide data;
 *  - filter parsing is validated with Zod (AGENTS.md §3 rule 5) and never trusts the raw string;
 *  - failure kinds carry no stack traces, paths, secrets or raw internal errors — only a
 *    correlation id the operator can quote (AGENTS.md §6, SECURITY.md).
 */

import { z } from "zod";
import { createAuthPort, authorize, type SessionContext } from "../auth/port";
import {
  getHqDashboardReadModel,
  isAuthorizedOutlet,
  type HqDashboardReadModel,
} from "../../features/hq/dashboard-read-model";
import { DEFAULT_BUSINESS_DAY_CONFIG, toBusinessDay } from "../../shared/time/business-day";

export interface DashboardRequestInput {
  /** `YYYY-MM-DD`; defaults to the server-derived business day for the current instant. */
  readonly date?: string | null;
  /** Outlet (= stall) id; `null`/absent means "Semua Outlet" within the authorized scope. */
  readonly outletId?: string | null;
}

export type DashboardFailureKind = "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_FILTER" | "UNAVAILABLE";

export type DashboardLoadResult =
  | { readonly ok: true; readonly requestId: string; readonly model: HqDashboardReadModel }
  | { readonly ok: false; readonly requestId: string; readonly kind: DashboardFailureKind };

export interface DashboardBoundaryDeps {
  readonly resolveSession?: () => Promise<SessionContext | null>;
  readonly now?: () => Date;
}

export function newRequestId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OUTLET_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Rejects well-formed but impossible dates (e.g. 2026-02-30). */
function isRealCalendarDate(value: string): boolean {
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

const DashboardQuerySchema = z.object({
  date: z
    .string()
    .refine((v) => DATE_PATTERN.test(v) && isRealCalendarDate(v))
    .optional(),
  outletId: z.string().regex(OUTLET_PATTERN).optional(),
});

function scopeAreaId(session: SessionContext): string | undefined {
  if (session.scope.kind === "area") return session.scope.areaId;
  if (session.scope.kind === "stall") return undefined;
  return undefined;
}

/**
 * Loads the dashboard for one authenticated viewer.
 * Never throws for expected failures — the caller renders a state instead of a stack trace.
 */
export async function loadHqDashboard(
  input: DashboardRequestInput = {},
  deps: DashboardBoundaryDeps = {},
): Promise<DashboardLoadResult> {
  const requestId = newRequestId();
  const now = deps.now ? deps.now() : new Date();

  let session: SessionContext | null = null;
  try {
    session = await (deps.resolveSession ?? (() => createAuthPort().resolveSession()))();
  } catch {
    // An auth port that cannot answer is an availability failure, not a permission decision.
    return { ok: false, requestId, kind: "UNAVAILABLE" };
  }
  if (!session) {
    return { ok: false, requestId, kind: "UNAUTHENTICATED" };
  }

  try {
    authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId });
  } catch {
    return { ok: false, requestId, kind: "FORBIDDEN" };
  }

  const parsed = DashboardQuerySchema.safeParse({
    date: input.date ?? undefined,
    outletId: input.outletId ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, requestId, kind: "INVALID_FILTER" };
  }

  const businessDay = parsed.data.date ?? toBusinessDay(now, DEFAULT_BUSINESS_DAY_CONFIG);
  const organizationId = session.organizationId;
  const areaId = scopeAreaId(session);
  const sessionScope = session.scope;

  // Everything below reads persistence, so a data failure must surface as an explicit
  // unavailability — never as a partially built dashboard and never as a thrown stack trace.
  try {
    // A stall-scoped viewer is pinned to their own outlet: asking for another one is a filter
    // violation, not a silent fallback to the organization view.
    const pinnedOutletId = sessionScope.kind === "stall" ? sessionScope.stallId : undefined;
    const requestedOutletId = parsed.data.outletId;
    if (pinnedOutletId && requestedOutletId && requestedOutletId !== pinnedOutletId) {
      return { ok: false, requestId, kind: "INVALID_FILTER" };
    }
    const outletId = pinnedOutletId ?? requestedOutletId;

    if (outletId && !isAuthorizedOutlet({ organizationId, areaId }, outletId)) {
      return { ok: false, requestId, kind: "INVALID_FILTER" };
    }

    const model = getHqDashboardReadModel({ organizationId, areaId, outletId, businessDay, now });
    return { ok: true, requestId, model };
  } catch {
    return { ok: false, requestId, kind: "UNAVAILABLE" };
  }
}

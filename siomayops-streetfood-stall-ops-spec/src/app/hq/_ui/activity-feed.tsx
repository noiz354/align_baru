/**
 * Recent activity feed — bound to `readModel.recentActivity` (derived from the append-only
 * audit log).
 *
 * Documented in `docs/integration/05-hq-dashboard-ui-integration.md`. Structured audit actions are
 * translated to Indonesian in `_lib/copy.ts`; unknown actions degrade to a neutral phrase instead
 * of leaking a raw code or crashing. Per the dashboard privacy rule (HQ-DASHBOARD.md §3.6) the
 * feed describes records, not people: no actor names, no per-person timeline.
 */

import type { ActivityEntry } from "@/features/hq/dashboard-read-model";
import { activityPhrase, activitySubjectLabel, EMPTY_ACTIVITY_MESSAGE } from "../_lib/copy";
import { formatJakartaTime } from "../_lib/format";

export interface ActivityFeedProps {
  readonly entries: readonly ActivityEntry[];
  /** outletId → outlet code, for a human-readable reference. */
  readonly outletCodes: Readonly<Record<string, string>>;
}

export function ActivityFeed({ entries, outletCodes }: ActivityFeedProps) {
  if (entries.length === 0) {
    return <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{EMPTY_ACTIVITY_MESSAGE}</p>;
  }

  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {entries.map((entry) => (
        <li key={entry.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          <time
            dateTime={entry.occurredAt}
            style={{ fontSize: 12, color: "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, monospace", minWidth: 44 }}
          >
            {formatJakartaTime(entry.occurredAt)}
          </time>
          <span style={{ fontSize: 13, color: "#111827" }}>
            {activityPhrase(entry.eventType)}
            <span style={{ color: "#9ca3af" }}> • </span>
            <span style={{ color: "#374151" }}>{activitySubjectLabel(entry.subjectKind)}</span>
            {entry.outletId ? (
              <span style={{ color: "#0f766e", fontWeight: 600 }}> {outletCodes[entry.outletId] ?? entry.outletId}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

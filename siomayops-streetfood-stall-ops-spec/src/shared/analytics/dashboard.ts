import type { DashboardAnalyticsEvent } from "@/shared/contracts/analytics";

/**
 * Browser-side analytics seam. It deliberately sends only stable dashboard
 * identifiers and never blocks a read or exposes operational free text.
 */
export function trackDashboardEvent(event: DashboardAnalyticsEvent): void {
  if (typeof window === "undefined") return;

  // MOCK ONLY — ANALYTICS NOT CONNECTED TO REAL TELEMETRY
  void fetch("/api/v1/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {
    // Analytics must not make the operational dashboard unusable when telemetry is unavailable.
  });
}

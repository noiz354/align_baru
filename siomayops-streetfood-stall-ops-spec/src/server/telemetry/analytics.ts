/**
 * Product analytics events for SiomayOps.
 *
 * Events are emitted server-side and/or client-side. They never include
 * secrets, raw audio/video/photo, unnecessary PII, or raw free-text notes.
 *
 * Downstream use: product/operational metrics, error tracking, usage patterns.
 */

import { logger } from "./logger";

export type AnalyticsEventName =
  | "dashboard_viewed"
  | "dashboard_filter_changed"
  | "dashboard_outlet_opened"
  | "dashboard_error_shown";

export interface AnalyticsEvent {
  readonly name: AnalyticsEventName;
  readonly occurredAt: string;
  readonly actorId?: string;
  readonly organizationId?: string;
  readonly pageId: string;
  readonly properties: Readonly<Record<string, string | number | boolean | null>>;
}

/** Prohibited property names that must never appear in analytics payloads. */
const PROHIBITED_PROPERTIES = new Set([
  "password",
  "token",
  "secret",
  "apiKey",
  "authToken",
  "sessionToken",
  "phoneNumber",
  "phoneE164",
  "email",
  "rawAudio",
  "rawVideo",
  "rawPhoto",
  "freeTextNote",
  "description",
]);

function sanitizeProperties(
  properties: Readonly<Record<string, string | number | boolean | null>>,
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (PROHIBITED_PROPERTIES.has(key)) continue;
    result[key] = value;
  }
  return result;
}

export function emitAnalytics(event: Omit<AnalyticsEvent, "occurredAt"> & { occurredAt?: string }): AnalyticsEvent {
  const full: AnalyticsEvent = {
    ...event,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    properties: sanitizeProperties(event.properties),
  };
  // Server-side: structured log entry for observability pipeline
  logger.info("analytics", {
    eventName: full.name,
    pageId: full.pageId,
    actorId: full.actorId,
    organizationId: full.organizationId,
    ...full.properties,
  });
  return full;
}

/**
 * Client-side analytics emitter. Posts events to the server-side analytics
 * endpoint for structured logging. Falls back silently on network failure.
 */
export function emitClientAnalytics(
  event: Omit<AnalyticsEvent, "occurredAt" | "actorId" | "organizationId">,
): void {
  const payload = {
    name: event.name,
    pageId: event.pageId,
    properties: sanitizeProperties(event.properties),
  };
  // Fire-and-forget; never block the UI
  if (typeof fetch !== "undefined") {
    fetch("/api/v1/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Analytics failure must never break the UI
    });
  }
}

import { describe, expect, it } from "vitest";
import { emitAnalytics } from "@/server/telemetry/analytics";

describe("analytics module", () => {
  it("emits a dashboard_viewed event with sanitized properties", () => {
    const event = emitAnalytics({
      name: "dashboard_viewed",
      pageId: "dashboard",
      actorId: "user-1",
      organizationId: "org-1",
      properties: {
        businessDay: "2026-09-29",
        outletCount: 6,
        activeOutlets: 4,
      },
    });
    expect(event.name).toBe("dashboard_viewed");
    expect(event.pageId).toBe("dashboard");
    expect(event.properties.businessDay).toBe("2026-09-29");
    expect(event.properties.outletCount).toBe(6);
    expect(event.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("strips prohibited properties from analytics payloads", () => {
    const event = emitAnalytics({
      name: "dashboard_outlet_opened",
      pageId: "dashboard",
      properties: {
        outletId: "loc-1",
        outletName: "Manggarai",
        password: "should-be-stripped",
        token: "should-be-stripped",
        phoneE164: "+6281234567890",
      },
    });
    expect(event.properties.outletId).toBe("loc-1");
    expect(event.properties.outletName).toBe("Manggarai");
    expect(event.properties).not.toHaveProperty("password");
    expect(event.properties).not.toHaveProperty("token");
    expect(event.properties).not.toHaveProperty("phoneE164");
  });

  it("emits dashboard_filter_changed events", () => {
    const event = emitAnalytics({
      name: "dashboard_filter_changed",
      pageId: "dashboard",
      properties: {
        filterKind: "search",
        filterValue: "Manggarai",
      },
    });
    expect(event.name).toBe("dashboard_filter_changed");
    expect(event.properties.filterKind).toBe("search");
  });

  it("emits dashboard_error_shown events", () => {
    const event = emitAnalytics({
      name: "dashboard_error_shown",
      pageId: "dashboard",
      properties: {
        errorKind: "load_failure",
        errorMessage: "timeout",
      },
    });
    expect(event.name).toBe("dashboard_error_shown");
    expect(event.properties.errorKind).toBe("load_failure");
  });

  it("never includes secrets or PII in any event type", () => {
    const prohibitedKeys = ["password", "token", "secret", "apiKey", "authToken", "sessionToken", "phoneNumber", "phoneE164", "email", "rawAudio", "rawVideo", "rawPhoto", "freeTextNote", "description"];
    const properties: Record<string, string | number | boolean | null> = {
      outletId: "loc-1",
    };
    for (const key of prohibitedKeys) {
      properties[key] = "should-be-removed";
    }
    const event = emitAnalytics({
      name: "dashboard_viewed",
      pageId: "dashboard",
      properties,
    });
    for (const key of prohibitedKeys) {
      expect(event.properties).not.toHaveProperty(key);
    }
    expect(event.properties.outletId).toBe("loc-1");
  });
});

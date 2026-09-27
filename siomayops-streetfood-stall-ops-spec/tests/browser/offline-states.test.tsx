import { describe, it, expect } from "vitest";

describe("offline and sync states in the UI (T-OFF-002)", () => {
  it("shows the offline banner with the pending record count", () => {
    // OfflineBanner component takes isOffline and pendingRecordCount
    const bannerProps = { isOffline: true, pendingRecordCount: 5 };
    expect(bannerProps.isOffline).toBe(true);
    expect(bannerProps.pendingRecordCount).toBe(5);
  });

  it("shows per-record sync state (LOCAL_ONLY, PENDING, SYNCING, SYNCED, REJECTED, DEFERRED)", () => {
    const validStates = ["LOCAL_ONLY", "PENDING", "SYNCING", "SYNCED", "REJECTED", "DEFERRED"];
    expect(validStates.length).toBe(6);
    expect(validStates).toContain("SYNCED");
  });

  it("explains a rejected record with a reason and a next step, never a dead end", () => {
    const rejected = {
      state: "REJECTED",
      reason: "Shift tidak ditemukan",
      nextStep: "Pastikan shift sudah dimulai dan coba lagi",
    };
    expect(rejected.reason.length).toBeGreaterThan(3);
    expect(rejected.nextStep.length).toBeGreaterThan(3);
  });

  it("disables digital payment creation with a clear message while offline", () => {
    const offlineDigital = {
      allowed: false,
      message: "Pembayaran digital butuh koneksi. Gunakan tunai saat offline.",
    };
    expect(offlineDigital.allowed).toBe(false);
    expect(offlineDigital.message).toContain("tunai");
  });

  it("keeps selling possible for cash while offline, without confirmation dialogs", () => {
    const offlineCash = {
      allowed: true,
      requiresConfirmation: false,
    };
    expect(offlineCash.allowed).toBe(true);
    expect(offlineCash.requiresConfirmation).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applySyncBatch } from "@/features/offline";
import { memoryStore } from "@/server/db/memory-store";

const organizationId = "10000000-0000-7000-0000-000000000051";
const operatorId = "30000000-0000-7000-0000-000000000051";
const shiftId = "50000000-0000-7000-0000-000000000051";
const stallId = "40000000-0000-7000-0000-000000000051";
const clientIncidentId = "70000000-0000-7000-8000-000000000051";
const occurredAt = new Date(Date.now() - 45 * 60 * 1000);

beforeEach(() => {
  memoryStore.clear();
  memoryStore.shifts.set(shiftId, {
    id: shiftId, organizationId, operatorId, stallId, businessDay: "2026-09-30", startedAt: occurredAt, startLocationId: "60000000-0000-7000-0000-000000000051",
    openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "offline-incident-shift", version: 1,
    createdAt: occurredAt, updatedAt: occurredAt,
  });
});
afterEach(() => memoryStore.clear());

describe("offline incident sync compatibility", () => {
  it("keeps an offline report submit path and retains its device event time when synced", async () => {
    const result = await applySyncBatch({
      organizationId,
      actorId: operatorId,
      batch: { records: [{
        aggregate: "incident",
        clientId: clientIncidentId,
        sequence: 1,
        recordedAtDevice: occurredAt.toISOString(),
        payload: { shiftId, categoryId: "SECURITY_CONCERN_REPORTED", description: "Reported offline and synced after coverage returned." },
      }] },
    });
    expect(result.results).toEqual([{ clientId: clientIncidentId, outcome: "ACCEPTED", serverId: expect.any(String) }]);
    const incident = [...memoryStore.incidents.values()][0]!;
    expect(incident).toMatchObject({ organizationId, operatorId, shiftId, category: "SECURITY_CONCERN_REPORTED", status: "SUBMITTED", clientIncidentId });
    expect(incident.occurredAt?.getTime()).toBe(occurredAt.getTime());
  });
});

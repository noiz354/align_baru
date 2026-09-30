/** PHASE 0 — presentation-neutral Page 11 domain rules. */
import type { StoredTrafficBand } from "@/server/db/memory-store";

export const deriveTrafficBand = (count: number): StoredTrafficBand => {
  if (!Number.isInteger(count) || count < 0 || count > 500) {
    throw Object.assign(new Error("Estimated count must be an integer from 0 to 500"), { code: "VALIDATION_FAILED" });
  }
  if (count <= 4) return "QUIET";
  if (count <= 9) return "STEADY";
  if (count <= 19) return "BUSY";
  return "VERY_BUSY";
};

export const floorToTrafficHour = (instant: Date): Date => {
  const bucket = new Date(instant);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket;
};

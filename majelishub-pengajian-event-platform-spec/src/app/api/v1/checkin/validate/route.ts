/**
 * POST /api/v1/checkin/validate — Wave3 real QR/token check-in, idempotent.
 * One row per registration in event_attendance (unique registration_id).
 * Duplicate scan → ALREADY_CHECKED_IN (200, success-shaped). Wrong tenant → WRONG_EVENT (409) or INVALID_TOKEN (404).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { getDb, withTransaction } from "@/server/db/client";
import { organizationScope } from "@/shared/contracts/scope";
import { kajianEvents } from "@/server/db/schema/events";
import {
  findRegistrationByShortCode,
  hashTokenForLookup,
  findRegistrationByTokenHash,
  createAttendanceIfNotExists,
  findAttendanceByRegistrationId,
} from "@/server/db/repositories/registrations";
import { writeAuditEntry } from "@/server/audit/writer";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function isShortCode(v: string): boolean {
  return /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(v);
}

export async function POST(request: Request): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ code: "VALIDATION_FAILED", message: "Body harus JSON." }, { status: 422 }); }

  const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
  const token = typeof body?.token === "string" ? body.token.trim() : (typeof body?.qrPayload === "string" ? body.qrPayload.trim() : "");
  const shortCodeRaw = typeof body?.shortCode === "string" ? body.shortCode.trim().toUpperCase() : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined;
  const entranceId = typeof body?.entranceId === "string" ? body.entranceId.trim() : "entrance-1";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "device-1";
  const methodRaw = typeof body?.method === "string" ? body.method.trim().toUpperCase() : token ? "QR" : shortCodeRaw ? "SHORT_CODE" : "QR";

  if (!eventId || !isUuid(eventId)) {
    return Response.json({ code: "VALIDATION_FAILED", message: "eventId tidak valid.", fields: { eventId: "harus uuid" } }, { status: 422 });
  }
  const hasToken = Boolean(token);
  const hasShort = Boolean(shortCodeRaw);
  if (!hasToken && !hasShort) {
    return Response.json({ code: "INVALID_FORMAT", message: "Token atau short code harus diisi.", fields: { token: "wajib" } }, { status: 400 });
  }
  if (hasToken && token.length < 8) {
    return Response.json({ code: "INVALID_FORMAT", message: "Format token tidak valid.", fields: { token: "terlalu pendek" } }, { status: 400 });
  }
  if (hasShort && !isShortCode(shortCodeRaw)) {
    return Response.json({ code: "INVALID_FORMAT", message: "Format short code tidak valid (contoh: ABC-123).", fields: { shortCode: "format salah" } }, { status: 400 });
  }
  if (hasToken && !/^[a-f0-9]{32,128}$/i.test(token)) {
    // Allow hex tokens only; if not hex, treat as INVALID_FORMAT
    // For demo we also accept any opaque but length check already done; if non-hex, return INVALID_FORMAT
    return Response.json({ code: "INVALID_FORMAT", message: "Format token tidak valid.", fields: { token: "harus hex" } }, { status: 400 });
  }

  const db = getDb();
  const eventRows = await db.select().from(kajianEvents).where(eq(kajianEvents.id, eventId as any)).limit(1);
  const event = eventRows[0];
  if (!event) {
    return Response.json({ code: "NOT_FOUND", message: "Event tidak ditemukan." }, { status: 404 });
  }
  const orgId = event.organizationId as unknown as string;
  const scope = organizationScope(orgId);

  // Lookup registration
  let registration: any = null;
  if (hasToken) {
    const hash = hashTokenForLookup(token);
    registration = await findRegistrationByTokenHash(db, hash);
  } else if (hasShort) {
    registration = await findRegistrationByShortCode(db, shortCodeRaw);
  }

  if (!registration) {
    // Do not disclose whether token exists for other tenant — return INVALID_TOKEN mapped to 404 per taxonomy
    return Response.json({ code: "INVALID_TOKEN", message: "Token tidak valid atau sudah tidak berlaku." }, { status: 404 });
  }

  // Tenant/event isolation: registration must belong to same event AND same org
  if (String(registration.eventId) !== eventId) {
    return Response.json({ code: "WRONG_EVENT", message: "Token ini bukan untuk event ini." }, { status: 409 });
  }
  if (String(registration.organizationId) !== orgId) {
    return Response.json({ code: "WRONG_EVENT", message: "Token ini bukan untuk organisasi ini." }, { status: 409 });
  }
  if (registration.status === "CANCELLED") {
    return Response.json({ code: "REGISTRATION_CANCELLED", message: "Registrasi ini sudah dibatalkan." }, { status: 409 });
  }

  try {
    const result = await withTransaction(scope, async (tx) => {
      // Check existing attendance
      const existing = await findAttendanceByRegistrationId(tx, registration.id as string);
      if (existing) {
        return { attendance: existing, created: false as const };
      }
      const created = await createAttendanceIfNotExists(tx, {
        organizationId: orgId,
        eventId,
        registrationId: registration.id as string,
        checkedInBy: deviceId,
      });
      if (created.created) {
        await writeAuditEntry(
          {
            actionKey: "attendance.checkin",
            organizationId: orgId,
            scopeKind: scope.kind,
            targetType: "event_attendance",
            targetId: created.attendance.id,
            requestId: idempotencyKey,
          },
          tx,
        );
      }
      return created;
    }, { userId: deviceId });

    if (!result.created) {
      return Response.json({
        kind: "ALREADY_CHECKED_IN",
        code: "ALREADY_CHECKED_IN",
        message: "Peserta sudah check-in sebelumnya.",
        displayName: registration.attendeeName,
        checkedInAt: result.attendance.checkedInAt ? new Date(result.attendance.checkedInAt as any).toISOString() : new Date().toISOString(),
        registrationId: registration.id,
        attendanceId: result.attendance.id,
      }, { status: 200 });
    }

    return Response.json({
      kind: "VALID",
      code: "VALID",
      message: "Check-in berhasil.",
      displayName: registration.attendeeName,
      groupSize: 1,
      checkedInAt: result.attendance.checkedInAt ? new Date(result.attendance.checkedInAt as any).toISOString() : new Date().toISOString(),
      registrationId: registration.id,
      attendanceId: result.attendance.id,
    }, { status: 200 });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes("duplicate") || msg.includes("unique")) {
      const existing = await findAttendanceByRegistrationId(db, registration.id as string);
      return Response.json({
        kind: "ALREADY_CHECKED_IN",
        code: "ALREADY_CHECKED_IN",
        message: "Peserta sudah check-in sebelumnya.",
        displayName: registration.attendeeName,
        checkedInAt: existing?.checkedInAt ? new Date(existing.checkedInAt as any).toISOString() : new Date().toISOString(),
        registrationId: registration.id,
        attendanceId: existing?.id,
      }, { status: 200 });
    }
    return Response.json({ code: "INTERNAL", message: "Gagal memproses check-in." }, { status: 500 });
  }
}

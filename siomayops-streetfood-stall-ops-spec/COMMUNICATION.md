# COMMUNICATION

**Document ID:** DOC-COMMUNICATION
**Status:** Phase 0 (specification; **no messaging implemented**)
**Related:** FR-COMM-*, `LOCATIONS.md` §5, `NOTIFICATIONS.md`, `INCIDENTS.md`, `PRIVACY.md`

---

## 1. Scope: operational messaging, not a chat app

SiomayOps **does not replace WhatsApp** and must not try. The purpose is narrow: capture the
operational signals that today disappear into chat threads, and attach them to the operational
objects they belong to (area, stall, shift, location, incident).

```text
Operator post  →  Operations Timeline  →  HQ Dashboard / Alerts
HQ notice      →  Targeted delivery    →  Acknowledgement tracking
```

Explicitly out of scope: group chats, voice/video, stickers, social features, broadcast
marketing to customers, and any attempt to be a "general messaging platform".

---

## 2. Message taxonomy

### Operator → HQ signals

| Signal | Trigger in UI | Structured data captured | HQ effect |
| --- | --- | --- | --- |
| Location changed | Location flow | new location, reason, time | Location Changes card |
| Location crowded | One-tap from location screen | location status | Coverage advisory |
| Location unavailable | One-tap | status + reason | Nearby-stall notice |
| Requested to move | One-tap + optional note (neutral) | reason `ASKED_TO_MOVE` | Supervisor awareness; no conclusions |
| Temporary closure | One-tap | window | Coverage gap detection |
| Weather problem | One-tap | note | Performance expectation adjustment |
| Stock low / empty | One-tap from stock | item(s), remaining estimate | Restock prompt |
| Need assistance | Free-form (short) | area, category | Supervisor queue |
| Equipment problem | Structured → may create incident | equipment item, condition | Maintenance queue |
| Price clarification | Free-form with price refs | policy id | Pricing queue |
| Closing early | One-tap + reason | time, reason | Coverage gap + closing prompt |
| Incident | Incident flow | incident record | Incident queue |

### HQ → Operator signals

| Signal | Structured fields | Acknowledgement |
| --- | --- | --- |
| Price update | policy ids, effective date | **Required** (digest-bound) |
| Location instruction | target area/location, instruction, optional reason | Required for urgent |
| Stock information | item(s), note, ETA | Optional |
| Promotion | campaign ref, validity, scope | Optional |
| Operational notice | body, severity | Optional |
| Urgent notice | body, action required, deadline | **Required** with escalation to supervisor |
| Safety notice | body, affected area | Required |

---

## 3. Threading model

Threads are anchored to operational objects, not to free-form conversations:

```ts
interface MessageThread {
  threadId: string;
  organizationId: string;
  anchor:
    | { type: "AREA"; areaId: string }
    | { type: "STALL"; stallId: string }
    | { type: "SHIFT"; shiftId: string }
    | { type: "LOCATION"; sellingLocationId: string }
    | { type: "INCIDENT"; incidentId: string }
    | { type: "BROADCAST"; audience: AudienceSelector };
  participants: ParticipantRef[];   // by role/scope, not by hand-picked people lists
  createdAt: Date;
  closedAt?: Date;
}

interface OperationalMessage {
  messageId: string;
  threadId: string;
  authorRef: { type: "OPERATOR"|"HQ"|"SYSTEM"; id: string; role: string };
  kind: OperatorSignalKind | HqSignalKind | "TEXT";
  body?: string;                    // bounded length, plain text
  structuredPayload?: Record<string, unknown>;  // e.g. { locationId, reason }
  createdAt: Date;                  // device time when offline
  serverReceivedAt: Date;
  deliveryState: "QUEUED" | "SENT" | "DELIVERED" | "FAILED";
  acknowledgement?: { required: boolean; by: string[]; at: Date[] };
}
```

Why anchored threads: they eliminate "which group was that in?" archaeology, they inherit the
right permissions automatically, and they keep the compliance story simple.

---

## 4. Delivery behaviour

| Situation | Behaviour |
| --- | --- |
| Operator offline | Message queued locally, shown as "belum terkirim", sent on reconnect with device timestamp |
| HQ offline | Standard failure; draft preserved |
| Partial delivery | Per-recipient delivery state; urgent notices escalate to another channel after a timeout (planned) |
| Duplicate send | Idempotent by `clientMessageId` |
| Ordering | Per thread, ordered by `createdAt` then `serverReceivedAt` |
| Attachments | Optional small photos via pre-signed upload; size-limited; no documents by default |
| Retention | Per `RETENTION.md`; operational threads shorter than financial records |

---

## 5. Rules and guardrails

1. **Financial records never live in messages.** Amounts, payments, closings, and expenses are
   recorded in their own domain objects; a message may *reference* them, never carry them as
   the record (`FR-COMM-007`).
2. **No PII dumping.** Messages are not a place to paste customer phone numbers or full
   operator details.
3. **Neutral language for sensitive topics.** "Diminta pindah" is recorded as reported; the
   system never speculates about who asked or why (`EXPENSES.md` §9 principle applies).
4. **Urgent ≠ spam.** Urgent notices are rate-limited and require acknowledgement; a fatigued
   operator eventually ignores everything, so severity must mean something.
5. **No pressure messaging.** The system will never auto-message an operator about slow sales.
6. **Supervisor visibility.** Messages are visible to the operational chain in scope; peers see
   only what is explicitly broadcastable (e.g. a shared location note).
7. **Retention and deletion.** Withdrawn messages are marked, not silently deleted, where they
   relate to an operational event; retention applies to all.

---

## 6. HQ operational timeline (concept)

```text
[08:14] Andi  · SHIFT_START     · Mangkal Tebet Parkir Timur
[11:02] Andi  · LOCATION_CHANGE · → Mangkal Tebet Utara (ramai/penuh)
[11:03] HQ    · NOTICE          · "Harga paket naik besok, cek notifikasi harga"
[13:40] Andi  · STOCK_LOW       · Siomay (porsi) tersisa ± 15
[14:10] Sari (WH) · ISSUE       · 60 porsi, ETA 15:00
[14:55] Andi  · STOCK_RECEIVED  · 60 porsi (cocok)
[17:30] Andi  · EXPENSE         · Biaya lokasi Rp 10.000 (Uang keluar)
[18:12] Andi  · CLOSING_STARTED
[18:20] Andi  · SHIFT_CLOSED    · Selisih Rp 0
```

The timeline is the HQ "narrative" surface: one screen that explains a day without anyone
having to reconstruct it from memory.

---

## 7. Non-goals

- No general chat clone (Slack/WhatsApp parity is explicitly not a goal).
- No customer messaging in this module (campaign messages belong to loyalty, with consent).
- No voice notes in Phase 0 (bandwidth and moderation cost).
- No read-receipt pressure mechanics ("seen at 09:41" creating anxiety) beyond delivery state
  needed for urgent notices.

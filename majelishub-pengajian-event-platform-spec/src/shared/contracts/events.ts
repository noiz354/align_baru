/**
 * Domain event registry - the authoritative list of events, their payload shape and their rules.
 *
 * Where this belongs: `shared/contracts` because producers (features), consumers (jobs, notifications,
 * search indexing) and the outbox dispatcher all need the same types.
 * Specification: EVENTS.md (20 events; same-transaction outbox; NO message broker in the MVP - ADR-0010).
 *
 * Invariants (EVENTS.md §2):
 *   1. Payloads carry **ids, counts and enums only** - never names, contacts, transcript text, audio
 *      references or any personal data. Telemetry and audit share this rule.
 *   2. Every event carries `eventId` (ULID), `occurredAt` (UTC instant), `organizationId`,
 *      `causationId` (the request/command that caused it) and `correlationId`.
 *   3. Names are permanent: renaming an event requires a new event, never an edit.
 *   4. Consumers must be idempotent; dedupe is by `eventId`.
 *
 * Why it is not implemented yet: publishing happens in the same transaction as the state change
 * (outbox), which needs the persistence layer (T-ARCH-006). This file is the contract that both sides
 * (T-ARCH-006 producer and every consumer) will compile against.
 */
export type Ulid = string;
export type IsoInstant = string;

export interface DomainEventEnvelope<TType extends string, TPayload> {
  readonly id: Ulid;
  readonly type: TType;
  readonly occurredAt: IsoInstant;
  readonly organizationId: Ulid;
  readonly correlationId: Ulid;
  readonly causationId?: Ulid;
  readonly payload: TPayload;
}

/** Payloads: ids, counts, enums. Adding a field here requires an EVENTS.md update in the same change. */
export type MosqueCreated = { mosqueId: Ulid; mosqueType: string };
export type SpeakerCreated = { speakerId: Ulid; createdByOrganizer: boolean };
export type KajianScheduled = { eventId: Ulid; programId?: Ulid; startsAt: IsoInstant; mosqueId: Ulid };
export type KajianPublished = { eventId: Ulid; registrationMode: string };
export type RegistrationOpened = { eventId: Ulid; registrationMode: string };
export type ParticipantRegistered = { eventId: Ulid; registrationId: Ulid; groupSize: number };
export type ParticipantWaitlisted = { eventId: Ulid; registrationId: Ulid; position: number };
export type WaitlistOfferIssued = { eventId: Ulid; registrationId: Ulid; expiresAt: IsoInstant };
export type RegistrationCancelled = { eventId: Ulid; registrationId: Ulid; reason: string };
export type ParticipantCheckedIn = {
  eventId: Ulid; registrationId: Ulid; attendanceId: Ulid; method: string; entranceId?: Ulid;
};
export type WalkInRegistered = { eventId: Ulid; attendanceId: Ulid; walkInRef: string };
export type DuplicateCheckInDetected = { eventId: Ulid; registrationId: Ulid; firstAttendanceId: Ulid };
export type AttendanceRecorded = { eventId: Ulid; attendanceId: Ulid; source: string };
export type AttendanceCorrected = { eventId: Ulid; attendanceId: Ulid; action: string };
export type RecordingStarted = { eventId: Ulid; sessionId: Ulid; policy: string };
export type RecordingStopped = { eventId: Ulid; sessionId: Ulid; durationMs: number; gapCount: number };
export type AudioUploadCompleted = { sessionId: Ulid; chunkCount: number };
export type TranscriptionRequested = { transcriptId: Ulid; assetId: Ulid };
export type TranscriptionCompleted = { transcriptId: Ulid; providerId: string; segmentCount: number };
export type TranscriptRevisionSaved = { transcriptId: Ulid; revisionNumber: number };
export type TranscriptApproved = { transcriptId: Ulid; revisionNumber: number };
export type TranscriptPublished = { transcriptId: Ulid; publishedRevisionId: Ulid };
export type TranscriptUnpublished = { transcriptId: Ulid; reason: string };
export type FeedbackSubmitted = { eventId: Ulid; anonymous: boolean; dimensionCount: number };
export type KajianCompleted = { eventId: Ulid; registeredCount: number; checkedInCount: number };
export type KajianCancelled = { eventId: Ulid; reason: string };
export type NotificationIntentCreated = { intentId: Ulid; templateKey: string; class: string };
export type RetentionRunCompleted = { policyKey: string; deletedCount: number; dryRun: boolean };

/** The full union. A consumer switch must be exhaustive (no default branch that swallows events). */
export type DomainEvent =
  | DomainEventEnvelope<"MosqueCreated", MosqueCreated>
  | DomainEventEnvelope<"SpeakerCreated", SpeakerCreated>
  | DomainEventEnvelope<"KajianScheduled", KajianScheduled>
  | DomainEventEnvelope<"KajianPublished", KajianPublished>
  | DomainEventEnvelope<"RegistrationOpened", RegistrationOpened>
  | DomainEventEnvelope<"ParticipantRegistered", ParticipantRegistered>
  | DomainEventEnvelope<"ParticipantWaitlisted", ParticipantWaitlisted>
  | DomainEventEnvelope<"WaitlistOfferIssued", WaitlistOfferIssued>
  | DomainEventEnvelope<"RegistrationCancelled", RegistrationCancelled>
  | DomainEventEnvelope<"ParticipantCheckedIn", ParticipantCheckedIn>
  | DomainEventEnvelope<"WalkInRegistered", WalkInRegistered>
  | DomainEventEnvelope<"DuplicateCheckInDetected", DuplicateCheckInDetected>
  | DomainEventEnvelope<"AttendanceRecorded", AttendanceRecorded>
  | DomainEventEnvelope<"AttendanceCorrected", AttendanceCorrected>
  | DomainEventEnvelope<"RecordingStarted", RecordingStarted>
  | DomainEventEnvelope<"RecordingStopped", RecordingStopped>
  | DomainEventEnvelope<"AudioUploadCompleted", AudioUploadCompleted>
  | DomainEventEnvelope<"TranscriptionRequested", TranscriptionRequested>
  | DomainEventEnvelope<"TranscriptionCompleted", TranscriptionCompleted>
  | DomainEventEnvelope<"TranscriptRevisionSaved", TranscriptRevisionSaved>
  | DomainEventEnvelope<"TranscriptApproved", TranscriptApproved>
  | DomainEventEnvelope<"TranscriptPublished", TranscriptPublished>
  | DomainEventEnvelope<"TranscriptUnpublished", TranscriptUnpublished>
  | DomainEventEnvelope<"FeedbackSubmitted", FeedbackSubmitted>
  | DomainEventEnvelope<"KajianCompleted", KajianCompleted>
  | DomainEventEnvelope<"KajianCancelled", KajianCancelled>
  | DomainEventEnvelope<"NotificationIntentCreated", NotificationIntentCreated>
  | DomainEventEnvelope<"RetentionRunCompleted", RetentionRunCompleted>;

/**
 * Outbox port. The producer writes the event in the SAME transaction as the state change; the
 * dispatcher delivers it later and marks it. Implementing the publisher is T-ARCH-006.
 * @throws Error("Not implemented: T-ARCH-006")
 */
export interface OutboxPort {
  publish(event: DomainEvent): Promise<void>;
}

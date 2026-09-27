// HomeOps — reusable validation primitives (T-PLAT-007, docs/api/CONVENTIONS.md §6).
//
// Shape validation is stated once here; business rules belong to the aggregate, not to a schema.
// Zod 4 is the boundary validator (STACK-2026 §7). Unknown keys are rejected by callers via
// `.strict()` — see `strictObject`.

import { z } from 'zod';
import { isLocalDate } from '../time/civil-date';
import { isValidTimezone } from '../time/timezone';

/**
 * Reusable Zod primitives so validation rules are stated once (docs/api/CONVENTIONS.md §6).
 * Shape validation happens here; business rules belong to the aggregate, not to a schema.
 * Implemented alongside T-PLAT-007 (Zod 4, SELECTED in docs/research/STACK-2026.md).
 */
export const LIMITS = {
  householdName: { min: 1, max: 40 },
  roomName: { min: 1, max: 40 },
  choreTitle: { min: 1, max: 80 },
  resourceName: { min: 1, max: 60 },
  assetName: { min: 1, max: 60 },
  issueTitle: { min: 1, max: 120 },
  note: { max: 500 },
  commentBody: { min: 1, max: 1000 },
  reason: { max: 140 },
  photoBytes: 5 * 1024 * 1024,
  photosPerIssue: 5,
  softCapRooms: 50,
  softCapResources: 120,
  softCapAssets: 60,
  softCapContainers: 10,
} as const;

/** C0/C1 control characters and DEL: never valid in member-authored text (SECURITY.md §5). */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/**
 * Trimmed, single-line-free-of-control-characters text. Bounds come from LIMITS so a change in the
 * product doc is a one-line change here.
 */
export function trimmedText(bounds: { readonly min: number; readonly max: number }, label: string) {
  return z
    .string()
    .trim()
    .min(bounds.min, `${label} must not be empty`)
    .max(bounds.max, `${label} must be ${bounds.max} characters or fewer`)
    .refine((value) => !CONTROL_CHARS.test(value), `${label} contains characters that are not allowed`);
}

/** Optional free text (notes, reasons): empty string and absent both mean "no note". */
export function optionalText(bounds: { readonly max: number }, label: string) {
  return z
    .string()
    .trim()
    .max(bounds.max, `${label} must be ${bounds.max} characters or fewer`)
    .refine((value) => !CONTROL_CHARS.test(value), `${label} contains characters that are not allowed`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));
}

export const householdNameSchema = trimmedText(LIMITS.householdName, 'Household name');
export const roomNameSchema = trimmedText(LIMITS.roomName, 'Room name');
export const choreTitleSchema = trimmedText(LIMITS.choreTitle, 'Title');
export const resourceNameSchema = trimmedText(LIMITS.resourceName, 'Resource name');
export const assetNameSchema = trimmedText(LIMITS.assetName, 'Asset name');
export const issueTitleSchema = trimmedText(LIMITS.issueTitle, 'Title');
export const noteSchema = optionalText(LIMITS.note, 'Note');
export const commentBodySchema = trimmedText(LIMITS.commentBody, 'Comment');
export const reasonSchema = optionalText(LIMITS.reason, 'Reason');

/** UUIDv7 ids are opaque to clients; we validate the shape only, never the ordering (FR-HH-012). */
export const idSchema = z.uuid('That link is not valid');

/** 'YYYY-MM-DD' interpreted in the household timezone (ADR-007). */
export const localDateSchema = z.string().refine((value) => isLocalDate(value), 'Use the format YYYY-MM-DD');

/** ISO-8601 instant, always UTC on the wire (docs/api/CONVENTIONS.md §3). */
export const instantSchema = z.iso.datetime('That time is not valid');

/** IANA timezone name; the list comes from the runtime, not from a hand-maintained array. */
export const timezoneSchema = z
  .string()
  .trim()
  .refine((value) => isValidTimezone(value), 'Choose a timezone from the list');

/** 'HH:MM' in household-local terms (quiet hours, collection windows). */
export const wallClockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the format HH:MM');

export const weekStartsOnSchema = z.enum(['MONDAY', 'SUNDAY']);

/** 0 = Sunday … 6 = Saturday (matches `weekdayOf`, docs/product/TRASH.md#schedule). */
export const weekdaySchema = z.number().int().min(0).max(6);

export const roleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'HELPER']);

/** Client-generated idempotency key (docs/api/CONVENTIONS.md §5). */
export const clientRequestIdSchema = z.uuid('That request could not be verified');

/**
 * Reject unknown keys: an extra field in a request body is a client bug or a probe, never something
 * to silently drop (docs/api/CONVENTIONS.md §6, NFR-SEC-003).
 */
export function strictObject<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}

/** Bounded integer with a member-facing message that states the bounds (DESIGN.md §17). */
export function boundedInt(min: number, max: number, label: string) {
  return z
    .number()
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);
}

/**
 * The bundle the skeleton named. Components and actions import the individual schemas above; this
 * exists so a test can assert the whole surface at once (T-PLAT-007).
 */
export function createValidationPrimitives() {
  return {
    LIMITS,
    householdNameSchema,
    roomNameSchema,
    choreTitleSchema,
    resourceNameSchema,
    assetNameSchema,
    issueTitleSchema,
    noteSchema,
    commentBodySchema,
    reasonSchema,
    idSchema,
    localDateSchema,
    instantSchema,
    timezoneSchema,
    wallClockTimeSchema,
    weekStartsOnSchema,
    weekdaySchema,
    roleSchema,
    clientRequestIdSchema,
    boundedInt,
    strictObject,
    trimmedText,
    optionalText,
  } as const;
}

export type ValidationPrimitives = ReturnType<typeof createValidationPrimitives>;

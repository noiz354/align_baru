/**
 * The `?next=` sanitizer for the sign-in page (T-AUTH-012).
 *
 * Requirements: FR-AUTH-002, NFR-SEC-005. Task: T-AUTH-012.
 *
 * After a successful sign-in the page navigates to `?next=`. An unsanitized
 * `next` is an open redirect: `https://evil.example/` would carry the fresh
 * session away the moment the user lands. The rule is "same-origin relative
 * paths only", enforced as a pure string function so it is unit-pinned
 * (UNIT-AUTH-004) rather than trusted to review:
 *
 * - kept: starts with exactly one `/`, no backslash, no control characters,
 *   no `..` segment (conservative — `/../x` normalizes in-origin, but the
 *   shelf fallback costs nothing and removes a class of parser games);
 * - everything else (absent, non-string, absolute URL, protocol-relative,
 *   scheme, bare relative): the member shelf `/library`.
 *
 * The fallback is a destination, never an error: a mangled `next` still
 * signs the reader in.
 */
export const SIGNIN_FALLBACK_NEXT = '/library';

/** `?next=` admits same-origin relative paths only; otherwise the shelf. */
export function sanitizeNextParam(value: unknown): string {
  if (typeof value !== 'string' || value === '') return SIGNIN_FALLBACK_NEXT;
  if (!value.startsWith('/') || value.startsWith('//')) return SIGNIN_FALLBACK_NEXT;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return SIGNIN_FALLBACK_NEXT;
  const firstSegment = value.slice(1).split('/', 1)[0];
  if (firstSegment === '' || firstSegment === '.' || firstSegment === '..') {
    return SIGNIN_FALLBACK_NEXT;
  }
  return value;
}

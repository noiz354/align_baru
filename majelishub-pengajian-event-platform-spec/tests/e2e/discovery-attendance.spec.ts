/**
 * E2E SKELETON - discovery-attendance.spec.ts
 * Layer: Playwright (composed stack) · Owning task: T-CHECKIN-014 · Requirement(s): FR-EVENT-014, FR-REG-001, FR-CHECKIN-004, FR-ATTEND-002
 * Scenario: TESTING.md §6.3 · Specification: TESTING.md §6.3 scenario 1
 * Phase 0: each step is registered with `test.fixme(title)` - a real Playwright API that declares the
 * test without executing it - so the scenario is machine-checkable and cannot drift from the spec while
 * nothing is implemented. Fake media devices and network conditions are
 * configured in playwright.config.ts (T-TEST-001).
 * Why this scenario: the whole promise of the product in one path: find a kajian, register, get a code, be checked in, see honest counts.
 */
import { test } from "@playwright/test";

test.describe("discovery to attendance", () => {
  test.fixme("a participant discovers a published event from the home list and opens it");
  test.fixme("registers with two fields and receives a QR and short code");
  test.fixme("reopens the code page from the notification and shows the same code (offline from cache)");
  test.fixme("a volunteer scans the code at the entrance and gets a confirmed check-in");
  test.fixme("the participant's status view now says sudah check-in with the time");
  test.todo("the organizer's attendance summary shows exactly one checked-in participant");});

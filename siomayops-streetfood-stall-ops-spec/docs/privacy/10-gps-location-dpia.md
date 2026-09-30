# Preliminary DPIA — Page 10 one-shot GPS assist

**Status:** Draft for privacy-owner / DPO review — **not approved for production processing**
**Date:** 2026-09-30
**Decision:** ADR-0039
**Page:** `/operator/location`

This is a technical pre-assessment, not legal advice, a completed organisational DPIA, or evidence of consent. Production capture must remain disabled until the designated privacy owner/DPO reviews and approves the final purpose, notice, retention implementation, rights path, and residual risk.

## Processing summary

| Item | Assessment |
|---|---|
| Data subjects | SiomayOps stall operators |
| Data | One device-reported latitude/longitude, accuracy in metres, and fix timestamp attached to an explicit shift-bound `LocationReport`; existing report context includes organization, operator, stall, shift, and selected selling-point ID |
| Purpose | Help the operator confirm an explicitly selected selling point and troubleshoot mismatches; never attendance, discipline, productivity scoring, or safety monitoring |
| Trigger | Foreground user tap for a single `getCurrentPosition` request followed by explicit report submission; manual report without GPS remains available |
| Source / reliability | Browser/device location provider; accuracy, time, and coordinates are device-reported, spoofable, and advisory—not proof of presence |
| Recipients | Submitting operator through the self-scoped flow; no HQ/map/dashboard projection of raw sample; no third-party location/analytics SDK |
| Retention | GPS fields purged within 14 days under ADR-0039/R-25; the selected selling-point report remains under R-09 with GPS fields removed |
| Transfers | No GPS sample is sent to tile, geocoding, analytics, or other third-party services |

## Necessity and alternatives

A manual selling-point report is always available. The fix can reduce mistakes when a place is unfamiliar, but is not required to work a shift. The sample is captured only after a tap and attached only if the operator elects to submit it with the location report. If permission is denied, the browser lacks support, accuracy is unacceptable to the operator, or the fix fails, the operator can submit the location ID without GPS.

## Risk and safeguards

| Risk | Initial rating | Controls / remaining work |
|---|---|---|
| Covert or continuous tracking | High | No `watchPosition`, page-load capture, timers, background permission, or periodic polling; checker allowlists one named one-shot helper and rejects watch/loop patterns; verify browser tests and review the shipped bundle |
| Unauthorized shift/tenant access | High | Server derives actor/org and verifies active shift ownership before write; read/write APIs are self-scoped; direct URL/cross-tenant tests required; production identity adapter is still absent |
| Excessive retention or a reconstructed short-term movement trace | Medium | One fix per explicit report, raw GPS fields expire after 14 days, report-only fields remain; production retention worker and backup-expiry verification are not yet implemented |
| GPS spoofing or poor accuracy treated as authoritative | Medium | Display accuracy/time and advisory wording; operator chooses selling point; server validates shape/freshness but cannot prove device truth; never use for attendance, pay, performance, or automatic status |
| Leakage via logs, analytics, map, or referrers | Medium | No coordinates/accuracy/entity IDs in analytics or audit summaries; `Cache-Control: no-store`; no third-party map request from this flow; tests inspect log/API projection |
| Permission denial or unavailable device | Low | Permission/error states are explicit; manual location report remains usable; no repeated prompts without another user action |
| Data subject cannot inspect/delete raw sample | Medium | Operator can see own latest sample in self-scoped UI; purge job and support/DSAR procedure must be verified before production |

## Data flow and deletion

```text
operator tap
  → one browser getCurrentPosition result
  → client displays coordinates/accuracy/time and selected site
  → operator explicitly submits one location report
  → server validates and verifies the authenticated operator's active shift
  → report + optional GPS sample persisted
  → telemetry records event/status only
  → by day 14, purge GPS sample fields; preserve non-GPS report under R-09
```

The pilot uses a JSON file-backed store. A restart/request-based purge is not equivalent to a reliable production retention schedule; a production daily retention job, backup expiry proof, deletion metrics without PII, and failure alerting remain acceptance gates.

## Approval checklist

- [ ] Privacy owner/DPO confirms necessity, purpose limitation, notice, and lawful basis.
- [ ] Confirm 14-day maximum and backup expiry with retention owner/legal adviser.
- [ ] Verify operator notice/access/deletion path and non-coercive manual alternative.
- [ ] Verify production authorization, route-specific permission policy, CSP, and no-third-party behavior.
- [ ] Run browser tests proving one user-tap call, no `watchPosition`, no background capture, and accurate permission/error UX.
- [ ] Sign and date the organisational DPIA; review residual risk before production feature enablement.

# ADR-0040: Gated human traffic video sampling

- **Status:** Accepted with production gates
- **Date:** 2026-09-30
- **Slice:** Page 11 / T-TRAFFIC-001
- **Area:** Privacy/Video
- **Related:** ADR-0007, ADR-0016, ADR-0020, ADR-0037, ADR-0038, `PRIVACY.md`, `RETENTION.md`, `docs/security/PERMISSIONS.md`

## Context

Page 11 requests a short video sample to support a human traffic estimate. Existing policy prohibits camera feeds and permits only explicit still-photo evidence/incident capture. A generic media MIME allowlist change would silently broaden that policy. The approved product boundary is intentionally narrower than general-purpose video capture and does not authorize production processing by itself.

## Decision

1. Page 11 camera use is an explicit, foreground operator action only. The camera does not start on page load, navigation, or a timer. Each clip is limited to 10 seconds, silent (`audio: false`), and captured only after an explicit tap. UI guidance asks the operator to frame general foot traffic and avoid faces, screens, and other unnecessary personal details. The operator can cancel without submitting a sample.
2. A clip may be uploaded only to private first-party storage. The upload path accepts only the supported browser video container and bounded payloads. It performs no face/person recognition, computer vision, biometric inference, external processor transfer, or model training. A manually entered integer count (and derived traffic band) is authoritative; the clip never produces a count automatically.
3. Raw video is temporary and must be irreversibly deleted from primary storage, replicas, and backups no later than 24 hours after upload (R-26). HQ, supervisors, auditors, and analytics cannot retrieve raw clips. There is no general-purpose download/share URL. Upload metadata is minimal and access-controlled; it must not become an alternate operator-monitoring dataset.
4. Persisted result metadata is separated from operator and shift identity: no `operatorId` or `shiftId` on a traffic result, no result-to-operator/shift join, and no individual performance, attendance, or disciplinary use. Result data may support reviewed coarse traffic aggregates only. Sample-level retention is provisionally 90 days (R-27), pending privacy-owner/DPO approval.
5. `TRAFFIC_SAMPLING_ENABLED` defaults off in non-production environments. This checkout unconditionally rejects all traffic-sampling operations when `NODE_ENV=production`; it has no production enablement path. A future production implementation must additionally require explicit privacy/DPO approval and verified scheduled deletion of primary objects and backup replicas. A local UI flag, test, or successful application-level delete is not proof of production purge.
6. A notice at the point of capture explains purpose, silent/short duration, manual estimate, 24-hour raw-video deletion, lack of HQ clip access, and an alternative to cancel and not upload. This is not described as employment consent.
7. Analytics may emit only allowlisted event names/outcomes, counts, and durations needed for service health; never clip bytes, filenames, URLs, hashes, coordinates, exact result counts, operator IDs, shift IDs, or free text.

## Consequences

- Page 11 is an explicit, time-bounded camera exception, not a live feed or surveillance feature. Incidental people may still appear in frames; privacy notice, short retention, framing guidance, access restrictions, and review gates remain necessary.
- The operator-entered count is distinct from uploaded video evidence. The clip must not be used as an automated estimator or training data.
- Production cannot be enabled with the current fake/in-memory services. A production private object-storage adapter, reliable purge and backup-expiry evidence, approved DPIA, authorization review, and operational monitoring are release prerequisites.
- Metadata separation reduces direct linkage, not all re-identification risk; coarse aggregates and access controls still require review.

## Alternatives considered

- Continue to prohibit video and provide a manual-only estimate (rejected for this Page 11 slice, but retained as the no-capture fallback).
- Allow an always-on or background feed (rejected as surveillance and outside the stated purpose).
- Run automated people/face detection or use a third-party processor (rejected; not approved).
- Keep video indefinitely for audit or model training (rejected; incompatible with minimisation and the approved 24-hour ceiling).

## Review gates

Before production: complete and approve a Page 11 DPIA; approve legal basis, notice and workplace safeguards with privacy owner/DPO; verify no audio or recognition/vision processor in the pipeline; verify private storage ACLs and no HQ clip access; implement scheduled primary-object purge and backup expiry within 24 hours and prove deletion; verify sample metadata separation and analytics redaction; complete access-control, retention, incident-response and browser runtime tests; set production flags only after all evidence is approved.

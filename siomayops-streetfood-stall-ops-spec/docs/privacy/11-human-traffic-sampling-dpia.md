# Preliminary DPIA: Page 11 human traffic video sampling

**Status:** Preliminary engineering assessment only — privacy-owner/DPO review and approval are pending. **Production video capture and upload must remain disabled.**

**Related:** ADR-0040, FR-TRAFFIC-001, NFR-PRIVACY-012, R-26/R-27, `PRIVACY.md`, `THREAT_MODEL.md`

## Processing summary

- **Purpose:** support manually entered, coarse foot-traffic planning estimates at an outlet.
- **Subjects:** the operator and incidental bystanders who may enter a short frame.
- **Data:** silent video, maximum 10 seconds; operator-entered count/band and coarse time/location context. No audio, face/person recognition, biometrics, CV, third-party processor, training, or inference about an individual.
- **Collection:** only after a foreground operator tap, with a point-of-capture notice and cancel/manual fallback. No continuous feed and no automatic page-load capture.
- **Storage/access:** private first-party object storage; no HQ, supervisor, auditor, or analytics access to raw clips. Raw objects and all replicas/backups must be deleted within 24 hours. Sample results carry no operator/shift identifiers and are not used for individual performance, attendance, or discipline.
- **Provisional result retention:** up to 90 days, subject to privacy-owner/DPO review; only reviewed coarse aggregate may outlive the sample-level row.

## Necessity and proportionality — preliminary

Manual count entry is the source of truth, so retaining video is not necessary to calculate the result. The narrow upload capability exists only because Page 11 explicitly requests short video evidence. A manual-only flow remains available if capture is unavailable or the operator chooses not to upload. The 10-second ceiling, silent capture, framing instructions, private storage, strict deletion, and no-identity/no-training constraints limit but do not remove incidental bystander privacy risk.

## Initial risk register

| Risk | Initial severity | Planned control | Residual status |
| --- | --- | --- | --- |
| Incidental bystander is identifiable in a frame | High | Camera angle/framing guidance; no audio; 10-second maximum; no recognition; 24-hour deletion; DPIA and notice | Requires DPO acceptance |
| Raw clip is accessed by an unauthorized HQ or staff account | High | No clip read route for HQ; private storage ACL; opaque IDs; least privilege; access audit | Must be proven in production storage |
| Object/backup survives the 24-hour limit | High | Scheduled purge, replica/backup TTL, deletion verification and alerting | **Blocking: not implemented/verified** |
| Video is repurposed for monitoring, recognition, or training | High | Purpose limitation, no inference/training pipeline, policy/contract restriction, review | Requires governance and technical verification |
| Result can be attributed to a worker from metadata or timing | Medium | No operator/shift keys or join; coarse aggregation; no individual performance use | Requires re-identification review |
| Operator feels capture is mandatory in an employment context | Medium | Explicit notice, manual/cancel alternative, no employment-consent claim, supervisor safeguards | Requires worker consultation/DPO review |

## Open decisions for privacy owner/DPO

1. Confirm legal basis and proportionality in an employment context; define worker notice/consultation and non-retaliation safeguards.
2. Approve or reject the 90-day result-metadata period and acceptable location/time granularity.
3. Approve primary and backup deletion architecture and evidence of complete purge within 24 hours.
4. Confirm access roles, incident handling, data-subject rights, and whether the use case can be enabled at all.
5. Review bystander-facing notice and physical capture conditions for each pilot location.

**Release decision:** no production enablement until every open decision is resolved, the DPIA is approved, and the primary/backup deletion control has been exercised and independently verified.

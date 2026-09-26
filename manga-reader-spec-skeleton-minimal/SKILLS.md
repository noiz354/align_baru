# Agent Skills inventory and mapping

## Inventory result
No Agent Skill registry, skill manifest, or installed skill files were present in the supplied workspace/tool surface when this architecture phase began. Therefore **no named Agent Skills are claimed available**. Do not fabricate skill names or claim discovery of inaccessible platform skills. Re-run inventory when a coding-agent environment exposes its actual skill catalogue.

## Capability coverage (not skill names)
These are competency areas, not installed skills. If actual available skill is discovered, record its exact name/source and map it below.

| Capability | Skill | Source | Purpose / applicable tasks | When to load | Expected output | Limitations |
|---|---|---|---|---|---|---|
| Architecture/ADR | Not available in inspected workspace | None observed | ADR-001..009; architecture tasks | architecture change | alternatives, consequences, traceability | Must not fabricate source |
| Product requirements | Not available | None observed | PRD and acceptance tasks | requirement change | stable IDs, acceptance cases | Product/legal decisions need owner |
| Next.js/React/TypeScript | Not available | None observed | EPIC-01 and routes | authorized UI slice | typed, accessible route/component | Respect stable API only |
| PostgreSQL/data design | Not available | None observed | EPIC-01 data tasks | schema/repository work | reviewed constraints/indexes | No migrations before task |
| API design | Not available | None observed | API contract tasks | boundary changes | DTO/errors/versioning | Contract is not handler implementation |
| Security/OWASP | Not available | None observed | EPIC-09, EPIC-07 | auth/upload/admin changes | abuse cases and verification | Independent security review still required |
| Accessibility/performance | Not available | None observed | reader/catalog tasks | interaction/render work | budgeted test plan | Automated tools insufficient |
| Image/object storage | Not available | None observed | EPIC-07 | ingestion/delivery work | threat-bounded pipeline contract | Provider and rights approval required |
| Vitest/Playwright | Not available | None observed | all testing tasks | test implementation | focused tests and evidence | No fake production behavior |
| Docker/CI/OpenTelemetry | Not available | None observed | EPIC-10/12 | deploy/ops work | least-privilege build and telemetry | External environment not provisioned |
| Code review/visual QA | Not available | None observed | milestone review | UI/security review | findings prioritized by risk | Requires actual running implementation |

When available: document exact displayed skill name, registry/source, version/revision if exposed, task mapping, limitations, then load only the relevant skill for the task.

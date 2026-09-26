# 2026 stack validation

Research snapshot: 2026-09-26 (Asia/Jakarta). Official references take precedence; versions move quickly, so resolve exact stable versions and compatibility matrix before lockfile. Search evidence was checked against official project pages; where current version endpoint did not provide a stable exact release, decision is major-line policy, not fabricated patch pin.

| Technology | Status | Selection / evidence / caveat |
|---|---|---|
| Node.js | SELECTED | Node 24 LTS for production; avoid Node 26 Current until LTS and ecosystem compatibility. Official release table identifies v24 LTS and v26 Current on snapshot date: https://nodejs.org/en/about/previous-releases |
| TypeScript | SELECTED | Strict mode, noUncheckedIndexedAccess/exactOptionalPropertyTypes to be enabled; stable compiler pinned at kickoff. Official handbook: https://www.typescriptlang.org/docs/ |
| Next.js | SELECTED | Stable App Router on current stable compatible line; verify stable release and Node support, pin exact. Avoid canary/experimental APIs. Official releases/docs: https://nextjs.org/docs and https://nextjs.org/blog |
| React | SELECTED | Stable release compatible with selected Next line, no canary/experimental features. https://react.dev/versions |
| Tailwind CSS | OPTIONAL | Utility styling only if UI team benefits; not architecture dependency. Use stable release; prefer CSS modules/plain CSS for accessible reader-specific layout. https://tailwindcss.com/docs |
| PostgreSQL | SELECTED | PostgreSQL 18 stable line on snapshot (released Sep 2025); managed service must support backups/PITR and extensions policy. Version policy use supported major, patch updates. https://www.postgresql.org/support/versioning/ and https://www.postgresql.org/docs/ |
| Drizzle ORM | SELECTED (subject to kickoff validation) | TypeScript-first relational mapping with PostgreSQL driver and explicit SQL escape hatches; keep queries in server/db and review generated SQL. Prisma is credible alternative with mature migration/client ecosystem but more generated abstraction; Kysely is strong typed query builder but lower-level. Require compatibility, migration review and pinned stable release; do not adopt RC. https://orm.drizzle.team/docs/ and https://www.prisma.io/docs/orm and https://kysely.dev/ |
| S3-compatible object store | SELECTED (interface) | Private bucket, lifecycle/version controls and signed access; provider remains OPEN until region, residency, egress, durability and legal requirements known. AWS S3 docs explain signed URLs and scoped expiry: https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html. S3 compatibility does not guarantee identical semantics. |
| Sharp | PLANNED | Mature libvips-backed image transformation candidate for future server pipeline; not installed. Native binaries/runtime compatibility, format policy and resource isolation require benchmark. https://sharp.pixelplumbing.com/ |
| Zod | SELECTED | Runtime validation for boundary DTO/config, inferred TS types; schemas are contracts not authorization. Stable releases: https://zod.dev/ |
| OpenTelemetry JS | SELECTED | Stable traces and metrics; logs are still Development in official status matrix, so use structured application logs and collector integration without claiming stable OTel log SDK. https://opentelemetry.io/docs/languages/js/ and https://github.com/open-telemetry/opentelemetry-js |
| Vitest | SELECTED | Unit/component-oriented test runner; ensure Node LTS compatibility. https://vitest.dev/ |
| Playwright | SELECTED | Browser E2E across engines and accessible interactions; pin browser versions in CI. https://playwright.dev/docs/intro |
| Docker | SELECTED | Reproducible local/CI and deploy artifact; multi-stage, non-root, minimal base, scanning. https://docs.docker.com/ |
| GitHub Actions | SELECTED | CI workflow platform; least permissions, pin actions by full commit SHA, protected environments. https://docs.github.com/actions |

## Alternatives / stack constraints
Next.js vs Remix/React Router: Next.js selected for mature integrated routing/server rendering and broad ecosystem; React Router framework is viable and avoids Next-specific coupling but would require separate conventions. Modular monolith avoids premature network boundaries. PostgreSQL vs MySQL: relational consistency and mature indexing/transactions fit catalog/progress; MongoDB not selected because relationships/constraints dominate. Drizzle vs Prisma vs Kysely compared above; no ORM removes need for reviewed DB constraints. S3 vs filesystem: filesystem is not durable/scalable shared media origin; self-hosted MinIO is useful locally but not a production provider decision. ImageMagick is powerful but broad attack surface/deployment footprint; Sharp selected candidate for constrained image transforms subject to decoder sandboxing. Elasticsearch/OpenSearch rejected initially: PostgreSQL search adequate until query/language/scale evidence shows otherwise. Redis rejected until measured cache/session/coordination requirement. Kafka/microservices/Kubernetes rejected absent independent scaling/team/throughput evidence.

## Versions and maturity policy
No exact patch/minor is asserted where official stable endpoint did not yield authoritative current value. Kickoff checklist: fetch official release channels on implementation start; select supported Node LTS; stable Next/React peer compatibility; stable Postgres supported major; ORM non-RC; update lockfile; test deployment runtime, Sharp native compatibility, Playwright browser; record date/versions and upgrade owner. Tailwind and Sharp remain optional/planned, not installed. Nothing in this research authorizes feature implementation.

## References (authoritative)
Node releases: https://nodejs.org/en/about/previous-releases
Next docs/release: https://nextjs.org/docs / https://nextjs.org/blog
React versions: https://react.dev/versions
TypeScript handbook: https://www.typescriptlang.org/docs/
PostgreSQL versioning: https://www.postgresql.org/support/versioning/
Drizzle docs: https://orm.drizzle.team/docs/
Prisma docs: https://www.prisma.io/docs/orm
Zod: https://zod.dev/
Sharp: https://sharp.pixelplumbing.com/
OTel JS status: https://opentelemetry.io/docs/languages/js/
Vitest: https://vitest.dev/ ; Playwright: https://playwright.dev/docs/intro
Docker: https://docs.docker.com/ ; GitHub Actions: https://docs.github.com/actions
OWASP file upload: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

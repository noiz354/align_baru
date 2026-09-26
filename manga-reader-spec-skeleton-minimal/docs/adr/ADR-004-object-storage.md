# ADR-004: Object storage

Status: Accepted (provider/version caveats noted below)
Date: 2026-09-26

## Context
Greenfield authorized manga reader requires dependable production foundation with simple operations, security and bounded reader/media performance. This decision governs future implementation, not implementation now.

## Decision Drivers
Stable support; mature ecosystem; operational simplicity; clear module boundary; licensing/security; performance on mobile; testability; data integrity.

## Options Considered

### Option A
Provider-neutral S3-compatible private object store accessed behind media port; select vendor later.

### Option B
Local filesystem

### Option C
Database blob storage

## Decision
Durable, scalable object delivery and CDN integration without DB blob load. Filesystem unsuitable across replicas/recovery; DB blobs inflate backup/IO. Risks S3-compatible semantic variance and egress; contract-test chosen provider, private buckets and lifecycle. Revisit provider after residency/cost/legal assessment. This is a constraint, not authorization to implement. Stack exact versions must be revalidated and pinned at kickoff.

## Consequences

### Positive
Clear default and migration boundary; avoids premature distribution and provider dependence where possible.

### Negative
Selected choice still requires operational expertise, periodic upgrades, and compatibility testing; some provider/library decisions remain open.

## Risks
Ecosystem changes or poor workload fit.

## Mitigations
Use adapter boundaries, operational tests and version review.

## Revisit When
provider after residency/cost/legal assessment.

## References
https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html

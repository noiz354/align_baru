# ADR-0014 — PostgreSQL full-text search + trigram instead of a search engine

- Status: Accepted · Date: 2026-09-26 · Deciders: Principal Architect, SRE
- Requirements affected: FR-CONTENT-004, NFR-PERF-009 · Related: ADR-0003, `CONTENT.md` §Search

## Context

Users must find: kajian by title/topic, mosques by name and area, speakers by name (with
transliteration variance — "Ustadz/Ustad/Ustadh", "Abdurrahman/Abdurrahman"), and text inside
**reviewed** transcripts. Corpus size for a large deployment: thousands of events, hundreds of
speakers, and transcripts of a few hundred thousand words per year. Queries are infrequent,
human-typed, and tolerate ~1 s latency.

## Decision

Use PostgreSQL native search:

- `tsvector` generated columns with the `indonesian` text search configuration for titles,
  descriptions, topics and transcript segment text (segment-level rows enable
  snippet + timestamp results).
- `pg_trgm` with GIN indexes for fuzzy/personal names and partial matches.
- Ranking: `ts_rank_cd` plus recency for events; **no engagement-based ranking** (ADR-0024).
- Arabic-script content is indexed as-is with a separate `simple`-config `tsvector`; Arabic
  morphological search is explicitly out of scope (a documented limitation, not a bug).
- Search results respect visibility policy: only `PUBLISHED` transcripts are searchable by the
  public; organizers search their own drafts within scope.

## Alternatives considered

- **Elasticsearch / OpenSearch.** *Gains:* better relevance tuning, analyzers, faceting,
  highlighting, scale. *Costs:* a stateful cluster (JVM, memory sizing, shards, backups,
  upgrades), a sync pipeline between Postgres and the index (with its own
  correctness/dual-write problems), and a skill the volunteer operator does not have.
  *Rejected at this scale; documented as an OPTION if the corpus grows ≥ 50× or if strict
  relevance tuning becomes a product requirement.*
- **Meilisearch / Typesense.** *Gains:* excellent developer UX, typo tolerance out of the box,
  much lighter than Elasticsearch. *Costs:* still a second datastore to run, secure, back up
  and keep in sync; extra data copy of *transcript text* (which is content with religious
  sensitivity) outside our primary boundary. *Rejected for MVP*; the first alternative to
  reconsider if Postgres search proves insufficient.
- **`pgvector` semantic search.** *Costs:* embeddings of religious text, hallucination-adjacent
  retrieval, and a misleading "answer" surface. *OPTIONAL, gated* on a future
  reviewer-assist feature; never a public "ask the archive" authority.
- **No search at all (browse only).** *Costs:* the archive becomes unusable after ~50 events,
  contradicting the product's purpose. *Rejected.*

## Consequences

**Positive:** zero new infrastructure; transcripts never leave the primary database boundary;
index maintenance is transactional with the data (no drift); snippet + timestamp navigation is
achievable with `ts_headline`.

**Negative:** relevance tuning is crude compared to a dedicated engine; very long transcript
text needs chunked indexing (segments) to keep `tsvector` sizes sane; Arabic search quality is
limited.

**Neutral:** `tsvector` columns are generated/updated by triggers or by the writer; the choice
affects write cost slightly (measured in `PERFORMANCE.md`).

## Enforcement

- A test asserts that unpublished or unpublished-by-moderation content never appears in public
  search results.
- An index-existence test ensures GIN indexes exist before VS-10 ships (a query plan check).
- Query performance budget: p95 ≤ 700 ms on the fixture corpus (`NFR-PERF-009`).

## Revisit trigger

Reopen if: p95 search latency exceeds budget with an indexed corpus > 5× the projected size;
users report systematic failures to find known content; or a deployment requires search across
organizations (which would also require a privacy review).

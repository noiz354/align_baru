# Conceptual data model (no schema/migrations)

IDs are opaque UUID/ULID identifiers, not sequential public identifiers. Timestamps UTC. Every FK/index/retention policy must be checked against actual workload and privacy/legal requirements before migration. Soft-delete/publication state is distinct from physical deletion.

| Entity | Purpose/owner/cardinality | PK, FKs, uniqueness/constraints | Indexes, lifecycle, deletion |
|---|---|---|---|
| User | Account principal; auth owns; 1:N sessions/library/progress/history | user_id; unique normalized email; role via scoped grants preferred | email unique; created/status; deactivate, avoid cascading audit |
| Session | Revocable auth session; user 1:N | session_id, user_id FK; hashed opaque token, expires/revoked | user+expiry; revoke/expire, remove on retention |
| Manga | Work/catalog aggregate root | manga_id; unique canonical slug; publication/status | slug unique; status+updated; unpublish before archive |
| MangaTitle | Localized title/aliases; manga 1:N | title_id, manga_id FK; locale+normalized title+kind unique per work | normalized title and manga; removed with work subject audit |
| Creator | Person/organization; many-to-many work via credit | creator_id; normalized identity cautious (duplicates possible) | name search; retain attribution under licensed content policy |
| Genre | Controlled taxonomy; N:M manga | genre_id, unique canonical slug | slug; retire rather than destructive delete |
| Tag | Curated discoverability; N:M manga | tag_id, unique slug | slug; retire, no user-generated tags initial |
| Chapter | Work 1:N; chapters owns order/publication | chapter_id, manga_id FK; unique manga+sequence; volume/chapter labels not globally unique | manga+publication+sequence; unpublish/retire; media cleanup separately |
| ChapterPage | Chapter 1:N ordered page descriptors | page_id, chapter_id FK; unique chapter+ordinal, positive ordinal/dimensions, opaque asset reference | chapter+ordinal; cascade logical retirement; object deletion asynchronous governed retention |
| LibraryEntry | User N:M Manga | entry_id; user+manga unique | user+updated, user+manga; user deletion policy anonymize/purge |
| ReadingProgress | User latest position by chapter; user/chapter unique | progress_id, user_id/chapter FKs; page ordinal valid at write | user+updated, chapter; clear on user request/content lifecycle |
| ReadingHistory | User activity event/summary; user 1:N | history_id, user/chapter FKs; occurred_at; avoid unnecessary event granularity | user+occurred, user+chapter; finite retention and delete/anonymize |
| Bookmark | User saved chapter/page/note-free anchor | bookmark_id, user/chapter/page refs; uniqueness policy user+chapter+page | user+created; invalidated/reconciled on page replacement |
| ReaderPreference | User 1:1 versioned preferences | user_id PK/FK; validated enum/ranges, schema_version | user PK; reset/delete on request |
| Upload | Admin ingestion aggregate; operator 1:N | upload_id, actor user FK; status state machine; idempotency key unique per actor | status+created, actor; quarantine cleanup and audit retention |
| AuditEvent | Append-only actor/action/resource event | event_id; actor nullable FK, resource opaque ID; minimize payload | resource/time, actor/time; append-only with access controls/legal retention |

### Cross-cutting invariants
Page numbers are one-based in API and conceptual model; any internal zero-based index must be explicit and converted at boundary. A page belongs to exactly one chapter; a chapter belongs to one manga. Public catalog visibility requires publication at both manga and chapter levels. Deletion of licensed media requires tombstone/unpublish and asynchronous object retention policy, not implicit DB cascade. Progress conflict resolution must use server timestamp/version plus monotonicity decision; page replacement must not silently point to a different image. See ADR-002/003 and security/data retention policies.

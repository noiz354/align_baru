# Admin workflow

1. Authenticated editor enters admin; server checks role and scoped capability.
2. Create/edit draft manga with title aliases, rights/authorization evidence reference held in controlled system, metadata and creator/genre/tag relationships.
3. Add chapters with stable sequence, language/edition metadata and publication intent; validate sequence/page manifest.
4. Operator initiates upload intent; source enters private quarantine with size/count limits and opaque upload ID.
5. Processing validates archive and image content, creates derivatives in staging, reports structured status; no auto-publication.
6. Editor reviews page count/order/preview and rights confirmation, resolves failures, explicitly publishes with version precondition.
7. Public visibility changes atomically after required checks; audit event captures actor/action/resource/outcome, not file bytes or secrets.
8. Unpublish/reject remains auditable; retention/cleanup follows legal and object-lifecycle policy.

States: draft → validating → processing → review-required → approved-for-publication → published; terminal/recoverable rejected/failed/canceled states. Exact transition graph, retries, replacement semantics and two-person approval remain open decisions. Stale role, stale version, duplicate intent, partial object set and revoked content must fail closed.

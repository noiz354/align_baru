# Performance budgets and reader resource model

Budgets are initial SLO targets on representative mid-tier mobile and desktop over documented network profiles; measure p75 and p95 separately, refine with field data. Cold/warm cache stated in dashboards. No optimization may weaken authorization.

| Measure | Initial budget |
|---|---|
| LCP | p75 ≤2.5 s for catalog/detail on mobile; p95 ≤4 s |
| INP | p75 ≤200 ms; investigate p95 >500 ms |
| CLS | ≤0.1 p75 |
| app server response | cacheable catalog p95 ≤300 ms; authenticated write p95 ≤500 ms excluding external auth |
| chapter-open to first usable page | p75 ≤2.0 s, p95 ≤4.0 s on defined 10 Mbps/80 ms RTT profile; degraded network communicate progress |
| search | p95 ≤400 ms up to specified indexed corpus, excluding network; re-baseline at scale |
| initial JS | route JS ≤200 KiB compressed target excluding framework shared budget; reader incremental ≤100 KiB; track total |
| request budget | initial catalog ≤30 app/API requests; chapter manifest one request, initial visible page(s) prioritized; no request per unseen chapter page |
| image delivery | responsive derivatives, modern formats only when supported; prioritize visible image; never force download whole chapter |
| memory | target ≤250 MiB incremental reader tab memory on reference mobile; monitor decode memory and browser eviction |
| reader growth | bounded page/image window; after 30 minutes or 500-page navigation, retained image resources plateau within configured window, no linear growth |

### 50/100/200/500-page chapters
Chapter length must affect manifest metadata, not eager image fetch/decode. Load visible pages and a small configurable adjacent window; cancel obsolete speculative requests; release distant decoded surfaces/object URLs; virtualization cannot break focus, scroll restoration, or screen readers. All four chapter sizes must have bounded O(window) active resources and bounded manifest size or cursor/chunk design; compare first-page latency, memory, failure recovery and navigation. Exact window policy, request concurrency, byte budgets, browser support and image dimension caps are tasks, not hardcoded here.

### Cache policy
Catalog metadata may use bounded revalidation keyed by publication revision. Private progress/preferences responses are private/no-store unless privacy-safe design explicitly proves otherwise. Image assets immutable by content/version identifier; origin private; delivery URL TTL and CDN cache-key behavior must not leak entitlement. Browser image cache is a hint, not persistence guarantee. Avoid caching signed URLs in logs. See ADR-004/007 and T-PERF tasks.

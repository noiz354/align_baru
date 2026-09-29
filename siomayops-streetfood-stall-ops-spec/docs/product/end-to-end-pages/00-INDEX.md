# SiomayOps — End-to-End Page Prompts

Setiap file di bawah adalah prompt mandiri untuk satu halaman/vertical slice dan mencakup frontend, backend, database/persistence, authorization, analytics/observability, tests, CI, dan runtime evidence.

## Recommended execution order

1. [Dashboard / Operasional Hari Ini](01-dashboard.md) — `/`
2. [Outlet Detail](02-outlet-detail.md) — `/hq/outlets/[id]`
3. [Mobile Operator Home](03-mobile-operator-home.md) — `/operator`
4. [Start / End Operation](04-start-end-operation.md) — `/operator/operation`
5. [Transactions — List, Detail, Create](05-transactions.md) — `/transactions`
6. [Expenses — List, Detail, Create](06-expenses.md) — `/expenses`
7. [Products & Pricing](07-products-pricing.md) — `/products`
8. [Reports & Export](08-reports-export.md) — `/reports`
9. [Live Operations Map](09-live-operations-map.md) — `/operations/map`
10. [GPS / Current Location Update](10-gps-location-update.md) — `/operator/location`
11. [Human Traffic Video Sampling](11-human-traffic-sampling.md) — `/operator/traffic-sampling`
12. [Weather & Site Suitability](12-weather-site-suitability.md) — `/operator/site-condition`
13. [Security Incident / Pemalakan Report](13-security-incident.md) — `/operator/incidents/new`
14. [Incident Evidence Review](14-incident-evidence-review.md) — `/hq/incidents/[id]`
15. [Conversation Recorder](15-conversation-recorder.md) — `/operator/recordings/new`
16. [Recordings Library & Detail](16-recordings-library.md) — `/recordings`
17. [Settings, Users & Access](17-settings-access.md) — `/settings`

## Global execution rule

Jalankan satu file sampai selesai dan evidenced sebelum pindah ke file berikutnya. Jangan menganggap page DONE karena UI sudah terlihat. Setiap slice harus membuktikan read/write path terhadap persistence nyata, scope authorization, analytics (atau gap eksplisit), tests, CI checks, serta runtime behavior.

## Cross-page completion order

Disarankan: Dashboard → Outlet Detail → Mobile Operator → Start/End Operation → Transactions → Expenses → Products/Pricing → Reports → Live Map → GPS → Traffic Sampling → Weather/Site → Security Incident → Incident Review → Conversation Recorder → Recordings Library → Settings/Access.
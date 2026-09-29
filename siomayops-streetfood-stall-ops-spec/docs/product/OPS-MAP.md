# HQ Peta Operasional (Live Operations Map)

**Document ID:** DOC-PRODUCT-OPS-MAP
**Status:** Screen 02 implemented as a working page with a deterministic read-model fixture (`/hq/operations/map`)
**Related:** `HQ-DASHBOARD.md`, `LOCATIONS.md`, `INCIDENTS.md`, `docs/design/DESIGN-SYSTEM.md`,
`docs/adr/ADR-0007-explicit-location-reporting.md`, `PRIVACY.md`

---

## 1. Purpose

Answers one question for the Operations Supervisor: *where are our mobile stalls right now, and is each
location operationally healthy?* The page is the second HQ screen and shares the HQ shell (sidebar,
topbar, tokens) with the dashboard.

Route: `/hq/operations/map` (tab **Peta Live** under nav **Operasional**). Data: `GET /api/v1/hq/ops-map`
(HQ_OPS scope), served from `src/features/hq/ops-map` (fixture read model until the field ingestion
pipeline lands).

## 2. What is on the screen

| Region | Content |
| --- | --- |
| Header | "Peta Operasional", business-day picker, freshness ("Diperbarui … lalu"), primary **+ Update Posisi** |
| Filter bar | Search "Cari outlet atau area", chips Semua Outlet · Status · Keramaian · Cuaca · Insiden · Update Terakhir |
| Map | Schematic vector basemap of South/Central Jakarta (self-hosted SVG, no third-party tiles), stall markers (green normal / amber attention / red incident / gray offline), clustered when overlapping, small event glyphs (sampling, wet area, security incident, temporary relocation, operator update), operator-reported weather zone |
| Right drawer | Selected stall: operator, status, last position, sales snapshot, **Kondisi Lokasi**, **Sampling Keramaian**, **Kelayakan Mangkal**, **Keamanan Lokasi** |
| Bottom-left | Collapsible **Aktivitas Lapangan** (latest events sent by operators) |
| Bottom-right | Legend with counts, scale bar, "Peta dasar skematik · posisi dilaporkan operator" |

## 3. Data-origin rules (unchanged from ADR-0007)

* Every position is an **explicit report from the operator app** (`OPERATOR_APP_GPS` / `OPERATOR_APP_MANUAL`)
  or an HQ-recorded pin. There is no background tracking; a stale report is shown as gray/"Offline".
* Weather / ground / shelter are operator site reports, not an external forecast.
* Traffic sampling is a **30-second clip counted anonymously**: the read model carries only a count, a band
  and an anonymised still. No faces, identities, demographics or vehicle plates are stored or displayed;
  the UI repeats the notice "Analisis anonim — Video digunakan untuk estimasi keramaian, bukan identifikasi
  individu."
* Security incidents use neutral category wording (e.g. "Permintaan uang tidak resmi"), show the
  operator's evidence count and the HQ review status only. No person is labelled and nothing is inferred
  automatically.
* "Kelayakan Mangkal" is a transparent weighted indicator over operator-reported factors; it is presented
  as an operational aid ("Pertimbangkan Relokasi"), never as a prediction or an instruction.

## 4. Implementation map

* `src/app/hq/operations/layout.tsx` — HQ shell for the Operasional section (`HQShell`).
* `src/app/hq/operations/map/page.tsx` — page; `_components/` (OpsMap, StallDrawer, FilterBar, overlays);
  `_map/` (Web-Mercator projection, schematic basemap data, seeded block generator, formatters).
* `src/features/hq/ops-map/` — read-model types, fixture, `getOpsMapReadModel`.
* `src/app/api/v1/hq/ops-map/route.ts` — authorised GET endpoint.
* `tests/unit/ops-map-read-model.test.ts` — invariants (explicit positions, anonymous sampling, neutral wording).
* Reference capture (1440×1024): `docs/design/screens/02-peta-operasional-1440x1024.png`.

# Global Cross-Cutting Gate — SiomayOps

Gunakan file ini setelah semua page prompt selesai untuk audit final lintas aplikasi.

## Backend
- Tidak ada page yang membaca persistence langsung dari React.
- Tidak ada duplikasi domain logic di route handlers.
- Semua write path melewati server validation + authorization + domain/service layer.
- Idempotency digunakan untuk mutation penting bila dibutuhkan.
- Semua list/history dibatasi dan memiliki filtering/pagination sesuai kebutuhan.

## Database / Persistence
- Setiap entity punya authoritative store yang jelas.
- Relasi dan ownership/scope dapat diverifikasi.
- Tidak ada fake fallback yang menyerupai production data.
- Money representation konsisten.
- Timezone/business-day semantics konsisten.
- Migration, bila ada, dapat dijelaskan dan diverifikasi.
- Restart durability dibuktikan bila storage memang durable.

## Security
- Authentication diuji.
- Cross-tenant/cross-outlet access ditolak server-side.
- Client tidak boleh menetapkan tenant/org/actor/privileged status.
- Upload media divalidasi.
- Private evidence tidak public-by-default.
- Audit trail tersedia untuk perubahan sensitif bila domain mendukungnya.

## Analytics
- Event naming konsisten.
- Payload tidak berisi raw sensitive media, secrets, atau free text sensitif.
- Success/failure events tersedia untuk flow penting.
- Analytics dapat dimatikan/diganti melalui abstraction bila arsitektur mendukung.

## Observability
- Structured errors/logs.
- Safe correlation IDs.
- Tidak ada secret/token/raw evidence di logs.
- Critical job/upload failures terlihat.
- Existing tracing/metrics digunakan bila tersedia.

## CI
Gate minimal:
```text
install
→ typecheck
→ lint
→ unit/focused tests
→ integration tests
→ production build
```

Tambahkan browser/E2E hanya jika infrastruktur proyek mendukungnya.

## Release evidence
- Semua page utama dibuka dengan data persisted nyata.
- Primary mutations terbukti bertahan setelah reload.
- Restart persistence diuji sesuai storage semantics.
- Unauthorized direct URL/API access diuji.
- Empty/error/loading states diuji.
- Mobile pages diuji di viewport mobile.
- Tidak ada console error/hydration error signifikan.
- Pre-existing failures dipisahkan dari regressions baru.

## Final status
Jangan menyatakan “100%”, “production ready”, atau menandai seluruh task selesai sebelum semua canonical acceptance criteria dan gate di atas memiliki evidence nyata.

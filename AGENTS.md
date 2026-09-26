# AGENTS.md — Project Collection Root

Monorepo of 8 independent project workspaces (each in its own folder).
Every folder is self-contained: read that folder's `AGENTS.md` + `README.md`
before writing any code there. Do not mix stacks or conventions across folders.

## Projects

| Folder | What it is | Stack | Status |
|---|---|---|---|
| `manga-reader-spec-skeleton-minimal/` | Licensed manga/comic reader — minimal spec skeleton (contracts + stubs only) | TypeScript / Next.js (planned) | Spec only, no implementation |
| `yomi-manga-reader-arch-skeleton/` | Yomi self-hosted manga/comic reader — full arch skeleton (services, repos, API routes) | TypeScript / Next.js, `package.json` name `yomi` | Spec only, no implementation |
| `homeops-household-manager-spec/` | HomeOps household manager (chores, issues, maintenance, rooms) | TypeScript / Next.js (planned) | Spec only, no implementation |
| `strangerlink-random-chat-webrtc-spec/` | StrangerLink random stranger chat (matchmaking, signaling, WebRTC, moderation) | TypeScript (planned) | Spec only, no implementation |
| `majelishub-pengajian-event-platform-spec/` | MajelisHub pengajian/kajian event platform (registration, QR check-in, audio, transcription) | TypeScript / Next.js (planned) | Spec only, no implementation |
| `parking-attendant-ops-app-spec/` | Parking attendant field-ops app (checkin/checkout, OCR, pricing, shifts) | Python (planned) | Spec only, no implementation |
| `siomayops-streetfood-stall-ops-spec/` | SiomayOps street-food stall network ops (HQ → stalls, stock, cash, loyalty) | TypeScript / Next.js (planned) | Spec only, no implementation |
| `rsi-agent-recursive-self-improvement-prototype/` | RSI recursive self-improvement coding-agent prototype (Curriculum → Actor → Verifier + Jev) | Python stdlib, zero required deps | Working prototype, run `python3 demo.py` |

## Root rules for agents

1. **Scope per folder.** A task targets exactly one project folder unless the
   user explicitly says otherwise. Never copy code or conventions between folders.
2. **Spec-first folders.** The six `*-spec` folders intentionally contain throwing
   stubs / `null` shells / todo tests. Implement only via that folder's `TASKS.md`
   in `ROADMAP.md` order, after reading its `AGENTS.md`. Do not "fill in" stubs
   unprompted.
3. **Working prototype.** `rsi-agent-*` is runnable; see its `AGENTS.md` for
   commands. Keep it dependency-free; keep `runs/` regenerable.
4. **Secrets.** Never commit `.env`, `*.tfvars`, API keys, or credentials.
   Real backends use environment variables only.
5. **Hygiene.** Keep `node_modules/`, `__pycache__/`, `.next/`, `dist/`,
   `runs/`-style generated output out of git (see root `.gitignore`).

# PRODUCT

One page per project. Scope is deliberately the **smallest useful real product**, not PRD completion.

**Rule for adding anything to this document:** state the real user problem. If there is no concrete
answer, it does not belong here. Section "Rejected" records what was considered and dropped, so the
next agent does not re-add it.

**Status vocabulary** (defined once, in `AUDIT_2026-09-28/REAL_AUDIT_SUMMARY.md`):
`UNUSABLE` · `DEMO_ONLY` · `MVP_BLOCKED` · `MVP_PARTIAL` · `MVP_USABLE` · `PRODUCTION_CANDIDATE`.
No percentages. No task counts.

---

## Workspace

Eight independent projects in one repository. Six are product work, one is an offline research
prototype, one (yomi) is under concurrent development by another agent and is out of scope for this
plan. **Do not mix stacks or conventions across folders** — that rule in the root `AGENTS.md` is
correct and should stay.

The repository has a real asset and a real disease. The asset is a small number of genuinely strong
implementations: a working RLS layer, a real authorization matrix, a correct payment-webhook verifier,
a durable hash-chained audit log, a domain with proven transaction semantics. The disease is that
documentation and CI stopped describing the code, so none of those strengths is protected and several
serious defects are invisible to every existing gate.

The plan in `specs/execution/` fixes the defects in that order.

---

## siomayops-streetfood-stall-ops-spec — `MVP_BLOCKED`

**The user problem.** A street-food stall operator is standing outside, holding a phone, serving a
queue of customers. They need to know who was selling, where, with what stock, for how much cash, and
whether the money adds up — on a bad connection, without losing a sale.

**Core jobs**

1. Open a shift with the cash actually in the drawer, and close it with a variance I can explain.
2. Record a cash sale, give correct change, survive a retry without charging twice.
3. Report that a customer paid digitally and have it settle — or be told honestly that it cannot.
4. See today: who is open, who has not reported a location, what is the cash position, what needs a
   decision.

**Explicit non-goals:** payment-provider settlement without merchant credentials; continuous GPS
tracking; accounting beyond the cash/close model; a consumer app; multi-currency.

**Out of scope for the next slices:** audio, push, loyalty UX polish, HQ heatmaps, scale-out. See
`AUDIT_2026-09-28/FEATURE_GAPS.md` §"Feature inflation explicitly rejected".

**Why it is blocked:** every core job currently has no identity. `GAP-P0-SIO-01`. The domain — pricing,
cash reconciliation, stock derivation, loyalty, audit — is real and tested. Only the front door is
missing.

---

## homeops-household-manager-spec — `MVP_BLOCKED`

**The user problem.** A household of three to five people shares a home. Nothing overflows silently,
and one screen answers "what needs attention today?" without becoming a project-management tool.

**Core jobs**

1. Sign in and see only my household.
2. See what is overdue and what is due today, and act on it.
3. Complete a chore and have the next occurrence appear, without duplicates.
4. Know a bin is full or supplies are low before it becomes a problem.
5. Add or remove a household member without losing their history.

**Explicit non-goals:** accounting, inventory ERP, IoT, chat, a social feed, an enterprise CMMS, per-
member performance metrics, numeric "cleanliness scores" (a product constraint, not an oversight).

**Why it is blocked:** there is no tenant boundary at all — `GAP-P0-HOM-01`, `GAP-P0-HOM-02` — and the
deploy migration does not create the domain tables — `GAP-P0-HOM-03`. The UI exists and looks right.
Nothing behind it is trustworthy.

---

## majelishub-pengajian-event-platform-spec — `MVP_BLOCKED`

**The user problem.** A masjid or kajian community runs a study circle. The organizer must publish
the schedule, the attendee must find it and register, and a volunteer at the entrance must check
people in by scanning a code — in Indonesian, outdoors, on a cheap phone, at arm's length.

**Core jobs**

1. An attendee finds a published kajian and sees where and when it is.
2. An attendee registers with a name and an email and receives a code they alone can use.
3. A volunteer scans that code and the check-in happens exactly once, even if scanned twice.
4. An organizer creates and publishes a kajian for their own organization, and cannot see another
   organization's data.
5. An organizer sees how many people came.

**Explicit non-goals:** audio capture and transcription (VS-4+, blocked behind the primary flow);
leaderboards, popularity ordering, or any authority scoring (forbidden by ADR-0014/ADR-0024 and by the
product's own ethos); machine-generated religious content; payment collection.

**Why it is blocked:** the strongest data layer in the workspace is bypassed by the four public pages,
and three handlers authenticate the caller from a request header — `GAP-P0-MAJ-01`,
`GAP-P0-MAJ-02`, `GAP-P0-MAJ-06`.

---

## strangerlink-random-chat-webrtc-spec — `DEMO_ONLY`

**The user problem.** An adult wants to talk to one stranger, safely, without a profile, without a
history, and without being able to find the same person again.

**Core jobs**

1. Pass the age gate and consent, and reach a queue.
2. Get matched and exchange text; leave at any time.
3. Report the other person, and be safe afterwards.
4. Be kept out if I am banned — **and stay out after a restart.**

**Explicit non-goals:** group chat, image or video exchange, persistent profiles, a social graph,
fingerprinting, "unrestricted anonymous chat" (explicitly ruled out by the project's own `SAFETY.md`).

**Why it is not `MVP_USABLE`:** jobs 1–3 complete; job 4 does not survive a restart, because bans,
reports and moderation cases are process memory. `GAP-P1-SLK-01`.

---

## manga-reader-spec-skeleton-minimal — `MVP_BLOCKED`

**The user problem.** A reader of legally-licensed material wants to open a title, read a chapter
comfortably, and resume where they stopped — on any device.

**Core jobs**

1. Discover a published title and open a chapter.
2. Read in single, double or vertical mode, in the correct reading direction.
3. Sign in and resume on another device.
4. A content administrator curates the catalog.

**Explicit non-goals:** anything the licensor has not authorised; recommendations; social features;
DRM the project does not implement.

**Why it is blocked:** jobs 1–2 work; job 3 is single-machine only; job 4's surface is public and its
write path does not exist — `GAP-P0-MAN-01`, `GAP-P2-MAN-01`.

---

## parking-attendant-ops-app-spec — `DEMO_ONLY`

**The user problem.** An attendant is standing at a barrier in the rain. A vehicle arrives and they
need to record where it is parked and its identifying information, so it can be safely returned
later, and they need to close out their shift with a drawer they can explain.

**Core jobs**

1. Open a shift with the cash in the drawer.
2. Check a vehicle in and assign a free slot.
3. Quote the fee, take payment, give change.
4. Close the shift and reconcile the variance.

**Explicit non-goals:** a QRIS settlement claim without a verified provider (the code correctly
refuses); on-device OCR as a production recogniser; lost-ticket without a supervisor PIN; scale-out
before the UI exists.

**Why it is `DEMO_ONLY`:** all four jobs work through the domain API, are covered by 66 passing tests,
and survive a restart with a hash-chained audit ledger. **There is no attendant-facing surface** —
the `server.py` described in the audit evidence was never committed. `GAP-P1-PRK-01`.

---

## rsi-agent-recursive-self-improvement-prototype — `MVP_USABLE` (declared scope)

**The user problem.** A developer wants to know whether an agent can improve its own memory without a
parameter change, under bounded limits, with a human gate, and reversibly.

**Core jobs**

1. Run exploration → freeze → evaluate on an identical holdout, cold versus warm.
2. Propose → evaluate → human-gate → apply → verify → roll back.

**Explicit non-goals, and it says so itself:** live LLM providers, isolated candidate repositories,
rollback of real code, an OS sandbox, any claim that the mock cold/warm improvement predicts a real
coding agent.

**Nothing to do.** `DELIVERABLES.md` is the documentation standard the other six should meet. Only
the stale test count needs correcting.

---

## yomi-manga-reader-arch-skeleton — out of scope

Under concurrent development by another agent. Not inspected, not modified, not planned here. Any
agent taking a slice from `specs/execution/` must confirm no other agent is active in that folder
first — see `OWNERSHIP.md`.

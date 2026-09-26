# StrangerLink — Product Metrics

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [OBSERVABILITY.md](../../OBSERVABILITY.md), [PRD.md](../../PRD.md) §15

---

## 0. Position

**Guardrail metrics are reviewed before growth metrics.** If the report rate is rising, we
do not celebrate a match-rate improvement.

We explicitly do **not** track: popularity, engagement streaks, session-count-as-achievement,
or anything that rewards keeping a user in a session longer than they want to be.

---

## 1. Guardrail metrics (safety-first)

| Metric | Definition | Target | Alert | Review cadence |
| --- | --- | --- | --- | --- |
| **Report rate** | Reports per 1,000 sessions | Trending down | Statistical spike → page | Daily |
| **P0 escalation rate** | Minor-safety + illegal-content reports per 10,000 sessions | As low as possible; any non-zero is investigated | Any occurrence → page | Daily |
| **P0 acknowledgement latency** | Time from P0 creation to acknowledgement | p95 < 15 min | > 15 min → page | Daily |
| **Ban rate** | Bans per 1,000 sessions | Monitored, not targeted | Spike → ticket | Weekly |
| **Ban appeal rate** | Appeals per ban | Monitored | Spike → ticket | Weekly |
| **Appeal overturn rate** | Overturned appeals / total appeals | **< 5%** | > 5% → ticket, review proportionality | Weekly |
| **Moderation disconnect rate** | Moderation-ended sessions / total sessions | Monitored | Spike → ticket | Weekly |
| **Report-after-disconnect rate** | Reports accepted against terminal sessions | **Non-zero** | Zero → investigate FR-REPORT-002 | Weekly |
| **Insufficient-information close rate** | Cases closed for lack of information | Monitored | Spike → review report quality or metadata window | Weekly |
| **Ban evasion detection rate** | Confirmed evasion cases | Monitored | — | Monthly |
| **Restricted-innocent rate** | Restrictions later overturned | Monitored | Spike → review risk-signal rules | Monthly |

**The appeal overturn rate is the single most important guardrail.** It measures whether we
are punishing the wrong people.

---

## 2. Experience metrics

| Metric | Definition | Target | Alert |
| --- | --- | --- | --- |
| **Time to match** | Landing → `MATCH_FOUND` | p50 < 30 s, p95 < 2 min | p95 breach → ticket |
| **Match success rate** | Matched sessions reaching `ACTIVE` / total matched | > 99% | Breach → ticket |
| **Queue abandonment** | Participants leaving the queue before a match | Monitored | Spike → ticket |
| **Queue expiry rate** | Queue entries reaching timeout | Monitored | Spike → investigate capacity |
| **Session duration** | Distribution of `ACTIVE` duration | Monitored, no target | — |
| **Skip rate** | Skips / total sessions | Monitored | Spike → investigate match quality |
| **Exit rate** | Clean exits / total sessions | Monitored | — |
| **Consecutive-requeue rate** | Sessions where the user requeued without a match | Monitored | Spike → review match quality |
| **Report submission success** | Successful report submissions / attempts | **100%** | Any failure → page |
| **Block submission success** | Successful blocks / attempts | **100%** | Any failure → page |

**There is deliberately no "time in session" growth target.** Maximising session duration
would be maximising the time a stranger spends with someone they may not want to talk to.

---

## 3. Media metrics

| Metric | Definition | Target | Alert |
| --- | --- | --- | --- |
| **Media mode adoption** | Media-mode sessions / total sessions | Monitored | — |
| **Permission grant rate** | Granted / prompted, per media type | Monitored | Drop → investigate UX |
| **WebRTC setup success rate** | Successful setups / attempts | > 95% | < 90% → ticket |
| **WebRTC setup duration** | p50 / p95 / p99 | See [PERFORMANCE.md](../../PERFORMANCE.md) | p95 breach → ticket |
| **TURN share of sessions** | Relay-path sessions / media sessions | Monitored; cost driver | Spike → ticket |
| **ICE restart rate** | Restarts / media sessions | Monitored | Spike → investigate networks |
| **Media downgrade rate** | Sessions dropping to text after a media failure | Monitored | Spike → investigate |

---

## 4. Platform metrics

| Metric | Definition | Target |
| --- | --- | --- |
| **Web p95 latency** | Per route | < 200 ms |
| **Web error rate** | 5xx / total | < 0.1% |
| **Realtime connection count** | Per instance | Within capacity |
| **Realtime error rate** | Errors / connections | < 0.5% |
| **Signaling validation failure rate** | Rejected frames / total | Monitored; a spike is an attack signal |
| **Database pool saturation** | Active / max | < 80% |
| **Retention job success** | Successful runs / total runs | **100%** |
| **Deploy frequency** | Deploys per week | Weekly or better |
| **Change failure rate** | Failed deploys / total | < 5% |

---

## 5. Cost metrics

| Metric | Definition | Review |
| --- | --- | --- |
| **TURN relayed bytes** | Per day, per instance | Weekly |
| **TURN cost per session** | Relay cost / media sessions | Weekly |
| **Infrastructure cost per session** | Total / sessions | Monthly |
| **Observability cost** | Backend spend | Monthly |

TURN is the dominant variable cost and is reviewed weekly, not monthly, because a bandwidth
spike is both a cost incident and a potential abuse signal.

---

## 6. Metrics we explicitly do not collect

| Not collected | Why |
| --- | --- |
| Session count per user as an achievement | Gamification |
| Time-in-session as a growth target | Rewards keeping users with strangers |
| Popularity or match-rate per user | Creates social-pressure dynamics |
| "Strangers met" counters | Same |
| Conversation content or sentiment | Privacy |
| Report note analytics | Privacy |
| Per-user retention cohorts | No accounts exist |
| Device fingerprints | Privacy |

---

## 7. Metric review cadence

| Review | Frequency | Owner | Output |
| --- | --- | --- | --- |
| Guardrail review | Daily | Trust & Safety | Action or no-action decision |
| Experience review | Weekly | Product | Prioritisation input |
| Media review | Weekly | Realtime | Reliability actions |
| Cost review | Monthly | Engineering + Finance | Budget actions |
| Full metrics review | Quarterly | All | Roadmap input |

---

## 8. Implementation status

No metric is implemented. Definitions are specified here and in
[OBSERVABILITY.md](../../OBSERVABILITY.md); implementation is tracked as **T-OBS-111**.

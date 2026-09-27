"""Static dashboard generated from `runs/` artifacts.

README Roadmap item 2: *"Dashboard atas `attempts.jsonl`: perbandingan trace,
tingkat keberhasilan per kategori, pertumbuhan coverage knowledge key."*

The dashboard is a single self-contained HTML file (inline CSS + inline SVG, no
CDN, no build step, no framework). It renders the operational views an operator
needs to answer "what changed, why, and can I undo it?":

    1. current baseline        -- memory revision, lesson count, key coverage
    2. loop health             -- acceptance / regression / rollback rates
    3. proposals               -- hypothesis, risk level, decision, diff
    4. evaluations             -- baseline vs candidate, metric by metric
    5. rollback                -- what was rolled back and to which revision
    6. history                 -- attempts by phase, success by category,
                                  knowledge-key coverage growth
    7. audit trail             -- hash-chain verification result

Nothing here talks to a server: the file is generated, so it can be committed,
emailed, or opened from disk.
"""
from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any, Iterable, Sequence

from .audit import AuditLog
from .memory import PersistentMemory

CSS = """
:root { --bg:#0f1117; --panel:#171a23; --line:#262b38; --fg:#e6e9ef;
        --muted:#9aa4b8; --ok:#3fb950; --bad:#f85149; --warn:#d29922;
        --accent:#58a6ff; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--fg);
       font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
header { padding:20px 28px; border-bottom:1px solid var(--line); }
header h1 { margin:0 0 4px; font-size:20px; }
header p { margin:0; color:var(--muted); }
main { padding:20px 28px 60px; max-width:1280px; }
section { background:var(--panel); border:1px solid var(--line);
          border-radius:10px; padding:16px 18px; margin-bottom:18px; }
h2 { margin:0 0 12px; font-size:15px; letter-spacing:.02em; text-transform:uppercase;
     color:var(--muted); }
table { width:100%; border-collapse:collapse; font-size:13px; }
th,td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line);
        vertical-align:top; }
th { color:var(--muted); font-weight:600; }
code,pre { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
pre { background:#0b0d12; border:1px solid var(--line); border-radius:8px;
      padding:10px 12px; overflow:auto; max-height:340px; }
.pill { display:inline-block; padding:1px 8px; border-radius:999px; font-size:11px;
        font-weight:600; }
.pill.ok { background:rgba(63,185,80,.15); color:var(--ok); }
.pill.bad { background:rgba(248,81,73,.15); color:var(--bad); }
.pill.warn { background:rgba(210,153,34,.15); color:var(--warn); }
.pill.info { background:rgba(88,166,255,.15); color:var(--accent); }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
        gap:12px; }
.card { background:#0b0d12; border:1px solid var(--line); border-radius:8px;
        padding:12px 14px; }
.card .k { color:var(--muted); font-size:11px; text-transform:uppercase; }
.card .v { font-size:22px; font-weight:650; margin-top:2px; }
.muted { color:var(--muted); }
.up { color:var(--ok); } .down { color:var(--bad); }
footer { color:var(--muted); padding:0 28px 40px; font-size:12px; }
"""


def _esc(value: Any) -> str:
    return html.escape(str(value), quote=True)


def _pill(text: str, kind: str) -> str:
    return f'<span class="pill {kind}">{_esc(text)}</span>'


def _outcome_pill(outcome: str) -> str:
    mapping = {
        "ACCEPT": "ok", "APPLIED": "ok", "PASS": "ok",
        "REJECT": "bad", "REJECTED": "bad", "FAIL": "bad",
        "ESCALATE": "warn", "ESCALATED": "warn",
        "ROLLED_BACK": "warn", "ROLLBACK": "warn",
        "BLOCKED": "warn", "NOOP": "info",
    }
    return _pill(outcome, mapping.get(outcome.upper(), "info"))


def _delta_cell(delta: float, higher_is_better: bool = True) -> str:
    if abs(delta) < 1e-9:
        return '<td class="muted">0.000</td>'
    good = delta > 0 if higher_is_better else delta < 0
    cls = "up" if good else "down"
    return f'<td class="{cls}">{delta:+.3f}</td>'


def _bar_chart(rows: Sequence[tuple[str, float]], *, width: int = 620,
               bar_height: int = 20, max_value: float | None = None) -> str:
    """Tiny dependency-free horizontal bar chart (inline SVG)."""
    if not rows:
        return '<p class="muted">no data</p>'
    peak = max_value if max_value else max(abs(v) for _, v in rows) or 1.0
    label_w = 190
    height = len(rows) * (bar_height + 6) + 8
    parts = [
        f'<svg viewBox="0 0 {width} {height}" width="100%" '
        f'height="{height}" role="img">'
    ]
    for index, (label, value) in enumerate(rows):
        y = index * (bar_height + 6) + 4
        bar_w = max(1.0, (abs(value) / peak) * (width - label_w - 70))
        color = "#3fb950" if value >= 0 else "#f85149"
        parts.append(
            f'<text x="0" y="{y + bar_height * 0.72:.1f}" fill="#9aa4b8" '
            f'font-size="11">{_esc(label[:34])}</text>'
        )
        parts.append(
            f'<rect x="{label_w}" y="{y}" width="{bar_w:.1f}" height="{bar_height}" '
            f'rx="3" fill="{color}" opacity="0.85"/>'
        )
        parts.append(
            f'<text x="{label_w + bar_w + 6:.1f}" y="{y + bar_height * 0.72:.1f}" '
            f'fill="#e6e9ef" font-size="11">{value * 100:.0f}%</text>'
        )
    parts.append("</svg>")
    return "".join(parts)


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------
def _load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    out: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


class DashboardData:
    """Everything the dashboard needs, read once from `runs/`."""

    def __init__(self, runs_dir: str | Path):
        self.runs_dir = Path(runs_dir)
        self.attempts = _load_jsonl(self.runs_dir / "attempts.jsonl")
        self.audit_events = _load_jsonl(self.runs_dir / "audit.jsonl")
        self.cycles = _load_json(self.runs_dir / "cycles.json")
        self.memory = _load_json(self.runs_dir / "memory.json")
        self.report = (
            (self.runs_dir / "report.md").read_text(encoding="utf-8")
            if (self.runs_dir / "report.md").exists() else ""
        )
        self.benchmarks = [
            _load_json(path)
            for path in sorted((self.runs_dir / "benchmarks").glob("*.json"))
        ] if (self.runs_dir / "benchmarks").exists() else []

    @property
    def memory_lessons(self) -> list[dict]:
        return list(self.memory.get("lessons", []))

    def audit_chain_ok(self) -> tuple[bool, list[str]]:
        audit = AuditLog(self.runs_dir / "audit.jsonl")
        return audit.verify_chain()

    def success_by_category(self) -> list[tuple[str, float]]:
        buckets: dict[str, list[bool]] = {}
        for attempt in self.attempts:
            if attempt.get("escalated"):
                continue
            key = str(attempt.get("task_title", "?"))[:32]
            buckets.setdefault(key, []).append(bool(attempt.get("success")))
        rows = []
        for key, values in buckets.items():
            rows.append((key, sum(values) / len(values) if values else 0.0))
        return sorted(rows, key=lambda r: r[1])

    def success_by_phase(self) -> list[tuple[str, float]]:
        buckets: dict[str, list[bool]] = {}
        for attempt in self.attempts:
            if attempt.get("escalated"):
                continue
            buckets.setdefault(str(attempt.get("phase", "?")), []).append(
                bool(attempt.get("success"))
            )
        return [
            (key, sum(v) / len(v) if v else 0.0)
            for key, v in sorted(buckets.items())
        ]


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------
def _render_baseline(data: DashboardData) -> str:
    lessons = data.memory_lessons
    active = [l for l in lessons if not l.get("deprecated")]
    keys = sorted({k for l in active for k in l.get("knowledge_keys", [])})
    revision = data.memory.get("revision") or (
        "mem-" + str(len(lessons)).rjust(16, "0")
    )
    cards = [
        ("Memory revision", revision[:22]),
        ("Lessons (active)", str(len(active))),
        ("Knowledge keys", str(len(keys))),
        ("Frozen", "yes" if data.memory.get("frozen") else "no"),
        ("Attempts traced", str(len(data.attempts))),
        ("Audit events", str(len(data.audit_events))),
    ]
    body = "".join(
        f'<div class="card"><div class="k">{_esc(k)}</div>'
        f'<div class="v">{_esc(v)}</div></div>'
        for k, v in cards
    )
    return (
        f"<section><h2>Current baseline</h2><div class=\"grid\">{body}</div>"
        f"<p class=\"muted\">Keys: {_esc(', '.join(keys))}</p></section>"
    )


def _render_loop_health(data: DashboardData) -> str:
    health = data.cycles.get("limits")
    cycles = data.cycles.get("cycles", [])
    accepted = sum(len(c.get("accepted", [])) for c in cycles)
    rejected = sum(len(c.get("rejected", [])) for c in cycles)
    escalated = sum(len(c.get("escalated", [])) for c in cycles)
    rolled_back = sum(len(c.get("rolled_back", [])) for c in cycles)
    blocked = sum(len(c.get("blocked", [])) for c in cycles)
    decided = accepted + rejected
    cards = [
        ("Cycles", str(len(cycles))),
        ("Accepted", str(accepted)),
        ("Rejected", str(rejected)),
        ("Escalated", str(escalated)),
        ("Rolled back", str(rolled_back)),
        ("Blocked", str(blocked)),
        ("Acceptance rate", f"{(accepted / decided * 100) if decided else 0:.0f}%"),
        ("Stop reason", str(data.cycles.get("stop_reason") or "—")[:26]),
    ]
    body = "".join(
        f'<div class="card"><div class="k">{_esc(k)}</div>'
        f'<div class="v">{_esc(v)}</div></div>'
        for k, v in cards
    )
    limits_note = ""
    if health:
        limits_note = (
            '<p class="muted">Limits: '
            + _esc(", ".join(f"{k}={v}" for k, v in health.items()))
            + "</p>"
        )
    return (
        f'<section><h2>Loop health</h2><div class="grid">{body}</div>'
        f"{limits_note}</section>"
    )


def _render_proposals(data: DashboardData) -> str:
    rows: list[str] = []
    for cycle in data.cycles.get("cycles", []):
        for proposal in cycle.get("proposals", []):
            decision = proposal.get("decision") or {}
            outcome = str(decision.get("outcome", "PENDING"))
            reasons = "; ".join(decision.get("reasons", [])) or "—"
            rows.append(
                "<tr>"
                f"<td><code>{_esc(proposal.get('id', ''))}</code></td>"
                f"<td>{_esc(proposal.get('target_component', ''))}</td>"
                f"<td>{_esc(proposal.get('risk_level', ''))}</td>"
                f"<td>{_outcome_pill(outcome)}</td>"
                f"<td>{_esc(proposal.get('hypothesis', ''))}</td>"
                f"<td class=\"muted\">{_esc(reasons)}</td>"
                "</tr>"
            )
    if not rows:
        return (
            '<section><h2>Proposals</h2><p class="muted">No improvement '
            "proposals recorded. Run <code>python -m rsi.cli improve</code>."
            "</p></section>"
        )
    return (
        '<section><h2>Proposals</h2><table><thead><tr>'
        "<th>ID</th><th>Target</th><th>Risk</th><th>Decision</th>"
        "<th>Hypothesis</th><th>Reasons</th></tr></thead><tbody>"
        + "".join(rows) + "</tbody></table></section>"
    )


def _render_evaluations(data: DashboardData) -> str:
    blocks: list[str] = []
    for cycle in data.cycles.get("cycles", []):
        for evaluation in cycle.get("evaluations", []):
            metric_rows = []
            for metric in evaluation.get("metrics", []):
                delta = float(metric.get("delta", 0.0))
                hib = bool(metric.get("higher_is_better", True))
                critical = (
                    ' <span class="muted">(critical)</span>'
                    if metric.get("critical") else ""
                )
                metric_rows.append(
                    "<tr><td>" + _esc(metric.get("name", "")) + critical + "</td>"
                    + "<td>%.3f</td><td>%.3f</td>" % (
                        float(metric.get("baseline", 0)),
                        float(metric.get("candidate", 0)),
                    )
                    + _delta_cell(delta, hib) + "</tr>"
                )
            regressions = evaluation.get("critical_regressions") or []
            if regressions:
                blocks.append(
                    '<p class="down">Critical regression(s): '
                    + _esc(", ".join(regressions)) + "</p>"
                )
            findings = evaluation.get("tamper_findings") or []
            finding_html = ""
            if findings:
                finding_html = (
                    '<p class="down">Tamper findings blocked this candidate:</p><ul>'
                    + "".join(f"<li>{_esc(f)}</li>" for f in findings) + "</ul>"
                )
            check_items = []
            for check in evaluation.get("checks", []):
                ok = bool(check.get("ok"))
                check_items.append(
                    "<li>" + _pill("pass" if ok else "fail", "ok" if ok else "bad")
                    + " <code>" + _esc(check.get("name", "")) + "</code> "
                    + '<span class="muted">' + _esc(check.get("detail", ""))
                    + "</span></li>"
                )
            checks = "".join(check_items)
            blocks.append(
                f'<section><h2>Evaluation <code>{_esc(evaluation.get("id", ""))}</code>'
                f' — proposal <code>{_esc(evaluation.get("proposal_id", ""))}</code></h2>'
                f'<p>{_outcome_pill("PASS" if evaluation.get("passed") else "FAIL")} '
                f'<span class="muted">benchmark {_esc(evaluation.get("benchmark_version", ""))}'
                f' · {float(evaluation.get("duration_s", 0)):.3f}s</span></p>'
                "<table><thead><tr><th>Metric</th><th>Baseline</th>"
                "<th>Candidate</th><th>Delta</th></tr></thead><tbody>"
                + "".join(metric_rows) + "</tbody></table>"
                f'<h2>Checks</h2><ul>{checks}</ul>{finding_html}</section>'
            )
    if not blocks:
        return (
            '<section><h2>Evaluations</h2><p class="muted">No candidate '
            "evaluations recorded.</p></section>"
        )
    return "".join(blocks)


def _render_rollback(data: DashboardData) -> str:
    rows = [
        "<tr><td><code>" + _esc(e.get("id", "")) + "</code></td>"
        "<td>" + _esc(e.get("kind", "")) + "</td>"
        "<td>" + _esc(e.get("proposal_id") or "—") + "</td>"
        "<td><pre>" + _esc(json.dumps(e.get("details", {}), indent=1)[:1200])
        + "</pre></td></tr>"
        for e in data.audit_events
        if "rollback" in str(e.get("kind", "")).lower()
    ]
    if not rows:
        return (
            '<section><h2>Rollback</h2><p class="muted">No rollbacks recorded. '
            "Archived baselines live in <code>runs/baseline-*.json</code>."
            "</p></section>"
        )
    return (
        '<section><h2>Rollback</h2><table><thead><tr><th>Event</th><th>Kind</th>'
        "<th>Proposal</th><th>Detail</th></tr></thead><tbody>"
        + "".join(rows) + "</tbody></table></section>"
    )


def _render_history(data: DashboardData) -> str:
    attempt_rows = [
        "<tr>"
        f"<td><code>{_esc(a.get('task_id', ''))}</code></td>"
        f"<td>{_esc(a.get('phase', ''))}</td>"
        f"<td>{_esc(a.get('route', ''))}</td>"
        f"<td>{_pill('success' if a.get('success') else 'fail', 'ok' if a.get('success') else 'bad')}</td>"
        f"<td>{float(a.get('score', 0)):.2f}</td>"
        f"<td>{float(a.get('done_confidence', 0)):.2f}</td>"
        f"<td>{_esc(a.get('failure_mode') or '—')}</td>"
        f"<td>{'yes' if a.get('escalated') else 'no'}</td>"
        "</tr>"
        for a in data.attempts
    ]
    by_category = _bar_chart(data.success_by_category())
    by_phase = _bar_chart(data.success_by_phase())
    return (
        '<section><h2>History — attempts</h2>'
        + (("<table><thead><tr><th>Task</th><th>Phase</th><th>Route</th>"
            "<th>Result</th><th>Score</th><th>Done</th><th>Failure mode</th>"
            "<th>Escalated</th></tr></thead><tbody>"
            + "".join(attempt_rows) + "</tbody></table>")
           if attempt_rows else '<p class="muted">No attempts traced.</p>')
        + "</section>"
        '<section><h2>Success rate by task</h2>' + by_category + "</section>"
        '<section><h2>Success rate by phase</h2>' + by_phase + "</section>"
    )


def _render_audit(data: DashboardData) -> str:
    ok, problems = data.audit_chain_ok()
    counts: dict[str, int] = {}
    for event in data.audit_events:
        key = str(event.get("kind", "unknown"))
        counts[key] = counts.get(key, 0) + 1
    rows = "".join(
        f"<tr><td><code>{_esc(k)}</code></td><td>{v}</td></tr>"
        for k, v in sorted(counts.items())
    )
    chain = (
        _pill("chain intact", "ok") if ok
        else _pill("CHAIN BROKEN", "bad")
    )
    detail = ""
    if not ok:
        detail = "<pre>" + _esc("\n".join(problems)) + "</pre>"
    return (
        '<section><h2>Audit trail</h2>'
        f"<p>{chain} <span class=\"muted\">{len(data.audit_events)} event(s), "
        "append-only and hash-chained</span></p>"
        "<table><thead><tr><th>Event kind</th><th>Count</th></tr></thead><tbody>"
        + rows + "</tbody></table>" + detail + "</section>"
    )


def _render_benchmarks(data: DashboardData) -> str:
    if not data.benchmarks:
        return (
            '<section><h2>Benchmarks</h2><p class="muted">No benchmark snapshots. '
            "Run <code>python -m rsi.benchmark</code>.</p></section>"
        )
    rows = []
    for snapshot in data.benchmarks:
        metrics = snapshot.get("metrics", {})
        rows.append(
            "<tr>"
            f"<td><code>{_esc(snapshot.get('name', ''))}</code></td>"
            f"<td>{_esc(snapshot.get('config', {}).get('seed', ''))}</td>"
            f"<td>{float(metrics.get('cold_success_rate', 0)) * 100:.0f}%</td>"
            f"<td>{float(metrics.get('warm_success_rate', 0)) * 100:.0f}%</td>"
            f"<td class=\"up\">{float(metrics.get('success_rate_delta', 0)):+.2f}</td>"
            f"<td>{metrics.get('memory_lessons', 0)}</td>"
            "</tr>"
        )
    return (
        '<section><h2>Benchmarks</h2><table><thead><tr><th>Arm</th><th>Seed</th>'
        "<th>Cold</th><th>Warm</th><th>Delta</th><th>Memory</th></tr></thead><tbody>"
        + "".join(rows) + "</tbody></table></section>"
    )


def build_dashboard(runs_dir: str | Path = "runs",
                    out_path: str | Path | None = None) -> Path:
    """Render `runs/dashboard.html` from the artifacts in `runs/`."""
    data = DashboardData(runs_dir)
    out = Path(out_path) if out_path else Path(runs_dir) / "dashboard.html"
    out.parent.mkdir(parents=True, exist_ok=True)

    sections = "".join([
        _render_baseline(data),
        _render_loop_health(data),
        _render_proposals(data),
        _render_evaluations(data),
        _render_rollback(data),
        _render_benchmarks(data),
        _render_history(data),
        _render_audit(data),
    ])
    document = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RSI Agent — improvement dashboard</title>
<style>{CSS}</style>
</head>
<body>
<header>
  <h1>RSI Agent — improvement dashboard</h1>
  <p>Generated from <code>{_esc(str(Path(runs_dir)))}</code> ·
     baseline vs candidate · proposals · evaluations · rollback · history · audit</p>
</header>
<main>{sections}</main>
<footer>
  <p>Generated by <code>rsi.dashboard</code>. This file is a derived artifact:
  nothing here is authoritative, <code>runs/audit.jsonl</code> and
  <code>runs/memory.json</code> are.</p>
</footer>
</body>
</html>
"""
    out.write_text(document, encoding="utf-8")
    return out

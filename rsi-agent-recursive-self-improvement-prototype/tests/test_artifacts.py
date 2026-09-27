"""Tests for the artifacts the prototype produces: benchmarks, dashboard,
skill files, the RAO loop and the CLI (stdlib unittest, fully offline).

    python -m unittest discover -s tests -v
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rsi.benchmark import (
    BENCHMARK_SUITE_VERSION,
    BenchmarkConfig,
    BenchmarkSnapshot,
    comparability,
    compare_snapshots,
    load_snapshot,
    render_matrix,
    run_benchmark,
    run_matrix,
    save_snapshot,
)
from rsi.cli import build_parser, main as cli_main
from rsi.dashboard import DashboardData, build_dashboard
from rsi.jev import MockJev
from rsi.memory import PersistentMemory
from rsi.rao import RAOLoop
from rsi.skills import (
    CLAUDE_FILE,
    SKILL_FILE,
    export_skills,
    render_claude_markdown,
    render_skill_markdown,
    skill_stats,
)
from rsi.types import Lesson, new_id


def make_lesson(keys: list[str], *, confidence: float = 0.8,
                lesson_id: str | None = None, kind: str = "procedure") -> Lesson:
    return Lesson(
        id=lesson_id or new_id("lesson"),
        content=f"[{kind}] verified lesson about {', '.join(keys)}",
        knowledge_keys=list(keys),
        source_task_id="task-x",
        confidence=confidence,
        verified=True,
        created_at=1000.0,
        kind=kind,
    )


# ---------------------------------------------------------------------------
# Benchmark
# ---------------------------------------------------------------------------
class BenchmarkTests(unittest.TestCase):
    def test_snapshot_records_environment_and_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            snapshot = run_benchmark(
                BenchmarkConfig(name="arm", seed=0, waves=1, drs_rounds=1,
                                holdout=6),
                runs_dir=tmp, log=lambda _m: None,
            )
            self.assertEqual(snapshot.name, "arm")
            self.assertEqual(snapshot.config["seed"], 0)
            self.assertEqual(snapshot.environment["benchmark_suite_version"],
                             BENCHMARK_SUITE_VERSION)
            self.assertIn("cold_success_rate", snapshot.metrics)
            self.assertIn("warm_success_rate", snapshot.metrics)
            self.assertIn("loop_health", snapshot.metrics)
            self.assertIn("python", snapshot.environment)

    def test_snapshot_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            snapshot = run_benchmark(
                BenchmarkConfig(name="arm", seed=0, waves=1, drs_rounds=0,
                                holdout=6),
                runs_dir=tmp, log=lambda _m: None,
            )
            path = save_snapshot(snapshot, tmp)
            reloaded = load_snapshot(path)
            self.assertEqual(reloaded.metrics, snapshot.metrics)
            self.assertEqual(reloaded.environment, snapshot.environment)

    def test_same_seed_is_reproducible(self):
        with tempfile.TemporaryDirectory() as tmp:
            first = run_benchmark(
                BenchmarkConfig(name="a", seed=3, waves=1, drs_rounds=1,
                                holdout=6),
                runs_dir=tmp, log=lambda _m: None,
            )
            second = run_benchmark(
                BenchmarkConfig(name="b", seed=3, waves=1, drs_rounds=1,
                                holdout=6),
                runs_dir=tmp, log=lambda _m: None,
            )
            self.assertEqual(first.metrics["warm_success_rate"],
                             second.metrics["warm_success_rate"])
            self.assertEqual(first.metrics["memory_lessons"],
                             second.metrics["memory_lessons"])

    def test_incomparable_environments_are_refused(self):
        a = BenchmarkSnapshot(name="a", config={}, environment={"python": "3.11.2"})
        b = BenchmarkSnapshot(name="b", config={}, environment={"python": "3.12.0"})
        ok, problems = comparability(a, b)
        self.assertFalse(ok)
        self.assertTrue(problems)
        report = compare_snapshots(a, b)
        self.assertIn("INCOMPARABLE", report)

    def test_comparable_snapshots_produce_a_delta_table(self):
        a = BenchmarkSnapshot(
            name="a", config={"seed": 0},
            environment={"python": "3.11.2",
                         "benchmark_suite_version": BENCHMARK_SUITE_VERSION,
                         "judge": "mock-jev", "planner": "mock_planner_factory"},
            metrics={"cold_success_rate": 0.1, "warm_success_rate": 0.4,
                     "memory_lessons": 10},
        )
        b = BenchmarkSnapshot(
            name="b", config={"seed": 7},
            environment={"python": "3.11.2",
                         "benchmark_suite_version": BENCHMARK_SUITE_VERSION,
                         "judge": "mock-jev", "planner": "mock_planner_factory"},
            metrics={"cold_success_rate": 0.1, "warm_success_rate": 0.6,
                     "memory_lessons": 14},
        )
        report = compare_snapshots(a, b)
        self.assertNotIn("INCOMPARABLE", report)
        self.assertIn("+0.2000", report)

    def test_matrix_runs_every_arm_and_renders(self):
        with tempfile.TemporaryDirectory() as tmp:
            snapshots = run_matrix(
                [BenchmarkConfig(name="one", seed=0, waves=1, drs_rounds=0,
                                 holdout=6),
                 BenchmarkConfig(name="two", seed=1, waves=1, drs_rounds=0,
                                 holdout=6)],
                runs_dir=tmp, log=lambda _m: None,
            )
            self.assertEqual(len(snapshots), 2)
            table = render_matrix(snapshots)
            self.assertIn("one", table)
            self.assertIn("two", table)
            self.assertTrue((Path(tmp) / "benchmarks" / "one.json").exists())


# ---------------------------------------------------------------------------
# Skills export
# ---------------------------------------------------------------------------
class SkillsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.memory = PersistentMemory(None)
        self.memory.add(make_lesson(["pytest", "fixtures"], confidence=0.9))
        self.memory.add(make_lesson(["golden"], confidence=0.6, kind="boundary"))

    def test_only_verified_active_lessons_are_exported(self):
        markdown = render_skill_markdown(self.memory)
        self.assertIn("pytest", markdown)
        self.assertIn("golden", markdown)
        self.assertIn(self.memory.revision(), markdown)
        self.assertIn("lesson_count: 2", markdown)

    def test_deprecated_lessons_are_excluded(self):
        lesson_id = self.memory.entries()[1].id
        self.memory.retire(lesson_id, superseded_by="lesson-new")
        markdown = render_skill_markdown(self.memory)
        self.assertNotIn("golden", markdown)
        self.assertIn("pytest", markdown)
        self.assertEqual(skill_stats(self.memory)["deprecated_excluded"], 1)

    def test_export_archives_the_previous_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            first = export_skills(self.memory, tmp, archive_previous=False)
            self.assertTrue((Path(tmp) / SKILL_FILE).exists())
            self.assertTrue((Path(tmp) / CLAUDE_FILE).exists())
            self.memory.add(make_lesson(["async"]))
            export_skills(self.memory, tmp, archive_previous=True)
            archives = list(Path(tmp).glob(f"{SKILL_FILE}.*.prev.md"))
            self.assertTrue(archives, "the previous skill file must be recoverable")
            # The archive is the older, smaller document.
            self.assertLess(len(archives[0].read_text(encoding="utf-8")),
                            len((Path(tmp) / SKILL_FILE).read_text(encoding="utf-8")))

    def test_export_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            export_skills(self.memory, tmp)
            before = (Path(tmp) / SKILL_FILE).read_text(encoding="utf-8")
            export_skills(self.memory, tmp)
            after = (Path(tmp) / SKILL_FILE).read_text(encoding="utf-8")
            self.assertEqual(before, after)

    def test_claude_fragment_points_at_the_skill_file(self):
        fragment = render_claude_markdown(self.memory)
        self.assertIn("SKILL.md", fragment)
        self.assertIn(self.memory.revision(), fragment)

    def test_export_refuses_a_secret_shaped_lesson(self):
        from rsi.sandbox import SecretLeakViolation

        self.memory.add(Lesson(
            id=new_id("lesson"), content="use api_key=sk-0123456789abcdefghij here",
            knowledge_keys=["security"], source_task_id="t", confidence=0.9,
            verified=True, created_at=1.0,
        ))
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(SecretLeakViolation):
                export_skills(self.memory, tmp)


# ---------------------------------------------------------------------------
# RAO loop
# ---------------------------------------------------------------------------
class RAOTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.target = Path(self._tmp.name) / "skills"
        self.target.mkdir()
        self.runs = Path(self._tmp.name) / "runs"
        self.memory = PersistentMemory(None)
        self.memory.add(make_lesson(["pytest", "fixtures"], confidence=0.9))
        self.memory.add(make_lesson(["golden"], kind="boundary"))

    def build(self, **kwargs) -> RAOLoop:
        return RAOLoop(self.memory, self.target, jev=MockJev(),
                       runs_dir=self.runs, **kwargs)

    def test_assessment_reports_a_real_delta(self):
        loop = self.build()
        assessment = loop.assess("# report\n\n| Cold | Warm |\n|---|---|\n| 20% | 60% |",
                                 {"cold_success_rate": 0.2, "warm_success_rate": 0.6})
        self.assertGreater(assessment.score, 0.0)
        self.assertTrue(assessment.strengths)
        self.assertIn("40pp", assessment.strengths[0])

    def test_assessment_flags_a_useless_run(self):
        loop = self.build()
        assessment = loop.assess("", {"cold_success_rate": 0.5,
                                      "warm_success_rate": 0.5})
        self.assertTrue(any("did not beat" in f for f in assessment.findings))
        self.assertTrue(any("empty" in f for f in assessment.findings))

    def test_noop_when_the_files_already_match(self):
        loop = self.build()
        first = loop.run("# report")
        self.assertEqual(first.outcome, "APPLIED")
        second = loop.run("# report")
        self.assertEqual(second.outcome, "NOOP")
        self.assertEqual(len(loop.history), 2)

    def test_high_risk_rewrite_is_escalated_not_applied(self):
        from rsi.risk import RiskLevel

        loop = self.build(risk_policy=_critical_policy())
        result = loop.run("# report")
        self.assertEqual(result.outcome, "ESCALATED")
        self.assertFalse((self.target / SKILL_FILE).exists())
        self.assertIn("rao-escalated", loop.audit.counts())

    def test_approver_can_allow_a_high_risk_rewrite(self):
        from rsi.risk import RiskLevel

        loop = self.build(
            risk_policy=_critical_policy(),
            approval=lambda _p, _r: (True, "reviewed by alice"),
        )
        result = loop.run("# report")
        self.assertEqual(result.outcome, "APPLIED")
        self.assertEqual(result.approver, "human-approver")
        self.assertTrue((self.target / SKILL_FILE).exists())

    def test_written_files_match_what_memory_renders(self):
        loop = self.build()
        result = loop.run("# report")
        self.assertEqual(result.outcome, "APPLIED")
        self.assertEqual((self.target / SKILL_FILE).read_text(encoding="utf-8"),
                         render_skill_markdown(self.memory))
        self.assertEqual((self.target / CLAUDE_FILE).read_text(encoding="utf-8"),
                         render_claude_markdown(self.memory))

    def test_rollback_restores_the_archived_files(self):
        loop = self.build()
        loop.run("# report")
        original = (self.target / SKILL_FILE).read_text(encoding="utf-8")
        # A later, richer memory produces a different skill file.
        self.memory.add(make_lesson(["async", "http"]))
        loop.run("# report")
        updated = (self.target / SKILL_FILE).read_text(encoding="utf-8")
        self.assertNotEqual(original, updated)

        result = loop.rollback()
        self.assertEqual(result.outcome, "APPLIED")
        self.assertEqual((self.target / SKILL_FILE).read_text(encoding="utf-8"),
                         original)
        self.assertIn("rao-rollback", loop.audit.counts())

    def test_rao_cannot_target_project_code(self):
        loop = self.build()
        change_set, _ = loop.propose()
        self.assertTrue(change_set.patches)
        for patch in change_set.patches:
            self.assertIn(patch.path, (SKILL_FILE, CLAUDE_FILE))

    def test_every_rao_decision_is_audited(self):
        loop = self.build()
        loop.run("# report")
        kinds = loop.audit.counts()
        self.assertIn("rao-proposed", kinds)
        self.assertIn("rao-applied", kinds)
        ok, problems = loop.audit.verify_chain()
        self.assertTrue(ok, problems)


def _critical_policy():
    from rsi.risk import RiskLevel, RiskPolicy

    # Zero low-risk budget forces even a single skill-file rewrite to MEDIUM,
    # which the ceiling then refuses to auto-accept.
    return RiskPolicy(auto_accept_max_risk=RiskLevel.LOW, max_ops_for_low_risk=0)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class DashboardTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.runs = Path(self._tmp.name)

    def _seed_run(self) -> Path:
        from rsi.orchestrator import RSIOrchestrator

        orchestrator = RSIOrchestrator(runs_dir=self.runs, seed=0,
                                       log=lambda _m: None)
        orchestrator.explore(waves=1, tasks_per_wave=6, drs_rounds=1,
                             drs_tasks=3, improve_between_waves=True)
        orchestrator.freeze()
        orchestrator.evaluate(n=6)
        orchestrator.report()
        return self.runs

    def test_dashboard_is_self_contained_html(self):
        self._seed_run()
        out = build_dashboard(self.runs)
        html_text = out.read_text(encoding="utf-8")
        self.assertTrue(out.exists())
        self.assertIn("<!DOCTYPE html>", html_text)
        self.assertIn("<style>", html_text)
        self.assertNotIn("http://", html_text.replace("http://www.w3.org", ""))
        self.assertNotIn("https://", html_text)
        for section in ("Current baseline", "Loop health", "Proposals",
                        "Rollback", "Audit trail", "History"):
            self.assertIn(section, html_text, section)

    def test_dashboard_handles_an_empty_runs_dir(self):
        out = build_dashboard(self.runs)
        html_text = out.read_text(encoding="utf-8")
        self.assertIn("<!DOCTYPE html>", html_text)
        self.assertIn("no data", html_text)

    def test_dashboard_data_reads_the_artifacts(self):
        self._seed_run()
        data = DashboardData(self.runs)
        self.assertTrue(data.attempts)
        self.assertTrue(data.audit_events)
        self.assertGreaterEqual(len(data.memory_lessons), 1)
        ok, _ = data.audit_chain_ok()
        self.assertTrue(ok)
        self.assertTrue(data.success_by_category())
        self.assertTrue(data.success_by_phase())

    def test_dashboard_renders_evaluations_and_tamper_findings(self):
        self._seed_run()
        # Inject a tampered evaluation into the cycle history.
        cycles_path = self.runs / "cycles.json"
        payload = json.loads(cycles_path.read_text(encoding="utf-8"))
        payload["cycles"] = [{
            "cycle": 1, "started_at": 0.0, "duration_s": 0.1, "state": "RECORDING",
            "evidence_count": 2,
            "proposals": [{"id": "prop-x", "target_component": "memory:key:golden",
                           "risk_level": "LOW", "hypothesis": "cover golden",
                           "decision": {"outcome": "REJECT", "reasons": ["tamper"]}}],
            "evaluations": [{
                "id": "eval-x", "proposal_id": "prop-x", "passed": False,
                "benchmark_version": "holdout-v1", "duration_s": 0.01,
                "critical_regressions": ["holdout_success_rate"],
                "tamper_findings": ["R4 lesson x references benchmark task 't1'"],
                "checks": [{"name": "tamper-scan", "ok": False,
                            "detail": "R4 ...", "mandatory": True}],
                "metrics": [{"name": "holdout_success_rate", "baseline": 0.5,
                             "candidate": 0.4, "delta": -0.1,
                             "higher_is_better": True, "critical": True}],
            }],
            "accepted": [], "rejected": ["prop-x"], "escalated": [],
            "rolled_back": [], "blocked": [],
            "baseline_revision": "mem-a", "final_revision": "mem-a",
            "stop_reason": None, "limit_hits": [], "tool_calls": 0,
        }]
        cycles_path.write_text(json.dumps(payload), encoding="utf-8")
        out = build_dashboard(self.runs)
        html_text = out.read_text(encoding="utf-8")
        self.assertIn("prop-x", html_text)
        self.assertIn("R4 lesson x references benchmark task", html_text)
        self.assertIn("critical regression", html_text.lower())

    def test_dashboard_flags_a_broken_audit_chain(self):
        self._seed_run()
        audit_path = self.runs / "audit.jsonl"
        lines = [ln for ln in audit_path.read_text(encoding="utf-8").splitlines() if ln]
        if len(lines) > 1:
            del lines[0]
            audit_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        data = DashboardData(self.runs)
        ok, problems = data.audit_chain_ok()
        self.assertFalse(ok)
        self.assertTrue(problems)
        html_text = build_dashboard(self.runs).read_text(encoding="utf-8")
        self.assertIn("CHAIN BROKEN", html_text)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
class CliTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.runs = str(Path(self._tmp.name) / "runs")

    def test_parser_exposes_every_command(self):
        parser = build_parser()
        for command in ("run", "improve", "benchmark", "dashboard",
                        "skills", "rao", "audit", "status"):
            namespace = parser.parse_args([command])
            self.assertTrue(hasattr(namespace, "func"), command)

    def test_full_run_creates_every_artifact(self):
        code = cli_main(["run", "--runs-dir", self.runs, "--waves", "1",
                         "--drs-rounds", "1", "--holdout", "6",
                         "--improve", "--max-cycles", "2"])
        self.assertEqual(code, 0)
        base = Path(self.runs)
        for name in ("report.md", "memory.json", "attempts.jsonl",
                     "audit.jsonl", "cycles.json", "dashboard.html"):
            self.assertTrue((base / name).exists(), name)

    def test_status_and_audit_after_a_run(self):
        cli_main(["run", "--runs-dir", self.runs, "--waves", "1",
                  "--drs-rounds", "0", "--holdout", "6", "--improve",
                  "--max-cycles", "1"])
        self.assertEqual(cli_main(["status", "--runs-dir", self.runs]), 0)
        self.assertEqual(cli_main(["audit", "--runs-dir", self.runs, "--verify"]), 0)

    def test_audit_verify_detects_tampering(self):
        cli_main(["run", "--runs-dir", self.runs, "--waves", "1",
                  "--drs-rounds", "0", "--holdout", "6", "--improve",
                  "--max-cycles", "1"])
        audit_path = Path(self.runs) / "audit.jsonl"
        lines = [ln for ln in audit_path.read_text(encoding="utf-8").splitlines() if ln]
        self.assertTrue(lines)
        record = json.loads(lines[-1])
        record["details"]["forged"] = True
        lines[-1] = json.dumps(record)
        audit_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self.assertEqual(cli_main(["audit", "--runs-dir", self.runs, "--verify"]), 1)

    def test_skills_and_rao_commands(self):
        cli_main(["run", "--runs-dir", self.runs, "--waves", "1",
                  "--drs-rounds", "0", "--holdout", "6"])
        out_dir = str(Path(self._tmp.name) / "skills")
        self.assertEqual(cli_main(["skills", "--runs-dir", self.runs,
                                   "--out-dir", out_dir]), 0)
        self.assertTrue((Path(out_dir) / SKILL_FILE).exists())
        self.assertEqual(cli_main(["rao", "--runs-dir", self.runs,
                                   "--target-dir", out_dir,
                                   "--auto-approve"]), 0)
        self.assertTrue((Path(out_dir) / CLAUDE_FILE).exists())

    def test_improve_requires_an_existing_memory(self):
        self.assertEqual(cli_main(["improve", "--runs-dir", self.runs]), 2)

    def test_benchmark_quick_matrix(self):
        code = cli_main(["benchmark", "--runs-dir", self.runs, "--quick"])
        self.assertEqual(code, 0)
        benchmarks = Path(self.runs) / "benchmarks"
        self.assertTrue(list(benchmarks.glob("*.json")))

    def test_cli_is_invocable_as_a_module(self):
        result = subprocess.run(
            [sys.executable, "-m", "rsi.cli", "--help"],
            capture_output=True, text=True, timeout=120,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("benchmark", result.stdout)


if __name__ == "__main__":
    unittest.main()

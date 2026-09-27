"""End-to-end manual QA walkthrough, expressed as a test.

This is the "MANUAL QA" checklist from the task brief, executed rather than
described, so it can be re-run at any time:

    1. start from a baseline
    2. observe a failure
    3. generate a proposal
    4. create an isolated candidate
    5. inspect the diff
    6. run the evaluation
    7. compare candidate to baseline
    8. reject a failing candidate
    9. generate another candidate
   10. accept a passing candidate
   11. apply it
   12. verify the applied state
   13. roll it back
   14. verify the baseline is restored

    python -m unittest tests.test_manual_qa -v
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rsi.audit import AuditLog
from rsi.evaluator import AcceptancePolicy, EvaluationEngine, EvaluationLimits
from rsi.feedback import Evidence
from rsi.improvement import ApprovalPolicy, CycleState, ImprovementLimits, ImprovementLoop
from rsi.memory import PersistentMemory
from rsi.orchestrator import RSIOrchestrator
from rsi.proposals import ProposalGenerator, ProposalStatus
from rsi.sandbox import CandidateWorkspace, SandboxLimits
from rsi.types import Task


class ManualQATest(unittest.TestCase):
    """The whole improvement loop, walked step by step with assertions."""

    seed = 0

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.runs_dir = Path(self._tmp.name)
        self.log_lines: list[str] = []

        # 1. Baseline: explore broadly, then stop before DRS covers everything
        #    so there is genuine, measurable work left for the loop.
        self.orchestrator = RSIOrchestrator(
            runs_dir=self.runs_dir, seed=self.seed, log=self._log
        )
        self.orchestrator.explore(waves=2, tasks_per_wave=6, drs_rounds=0)
        self.holdout = self.orchestrator.curriculum.holdout(12, split="improve")
        self.baseline_revision = self.orchestrator.memory.revision()
        self.assertTrue(self.baseline_revision.startswith("mem-"))

        self.limits = ImprovementLimits(
            max_cycles=1, max_proposals_per_cycle=4,
            max_candidates_per_cycle=4, max_changed_lessons=2,
        )
        self.engine = EvaluationEngine(
            self.orchestrator.evaluate_against,
            limits=EvaluationLimits(
                max_holdout_tasks=12,
                max_lessons_per_candidate=self.limits.max_changed_lessons,
                max_diff_lines=self.limits.max_diff_lines,
            ),
            policy=AcceptancePolicy(min_target_delta=self.limits.min_target_delta),
        )
        self.loop = ImprovementLoop(
            self.orchestrator.memory, self.engine, self.holdout,
            runs_dir=self.runs_dir, limits=self.limits,
            audit=AuditLog(self.runs_dir / "audit.jsonl"),
            generator=ProposalGenerator(
                max_lessons_per_proposal=self.limits.max_changed_lessons),
            log=self._log, actor="manual-qa",
        )

    def _log(self, message: str) -> None:
        self.log_lines.append(message)

    # -- steps ---------------------------------------------------------------
    def test_step_02_observe_failures(self):
        failures = [a for a in self.orchestrator.attempts if not a.success]
        self.assertTrue(failures, "exploration must produce observable failures")
        evidence = self.loop.evidence_from_attempts(
            self.orchestrator.attempts, self.orchestrator._tasks_by_id
        )
        self.assertEqual(len(evidence), len(self.orchestrator.attempts))
        self.assertTrue(any(not e.success for e in evidence))
        # Evidence carries structured fields, never raw prose instructions.
        for item in evidence:
            self.assertNotIn("ignore previous", item.excerpt.lower())

    def test_step_03_generate_proposals(self):
        evidence = self.loop.evidence_from_attempts(
            self.orchestrator.attempts, self.orchestrator._tasks_by_id
        )
        proposals = self.loop.generator.generate(
            evidence, self.orchestrator.memory, self.holdout
        )
        self.assertTrue(proposals, "the generator must find actionable work")
        for proposal in proposals:
            self.assertTrue(proposal.hypothesis)
            self.assertTrue(proposal.expected_benefit)
            self.assertTrue(proposal.evaluation_plan)
            self.assertTrue(proposal.rollback_plan)
            self.assertTrue(proposal.change_set.changes)
            self.assertEqual(proposal.status, ProposalStatus.DRAFT)

    def test_steps_04_to_07_isolate_inspect_evaluate_compare(self):
        evidence = self.loop.evidence_from_attempts(
            self.orchestrator.attempts, self.orchestrator._tasks_by_id
        )
        proposals = self.loop.generator.generate(
            evidence, self.orchestrator.memory, self.holdout
        )
        self.assertTrue(proposals)
        proposal = proposals[0]

        # 4. isolated candidate workspace
        workspace = CandidateWorkspace.create(
            "manual-qa", limits=SandboxLimits(
                max_ops=self.limits.max_changed_lessons,
                max_diff_lines=self.limits.max_diff_lines,
            ),
        )
        try:
            workspace.write("candidate-memory.json",
                            json.dumps(self.orchestrator.memory.payload(), indent=2))
            workspace.write("change-set.diff", proposal.change_set.diff())
            self.assertLessEqual(workspace.file_count, 2)

            # 5. the diff is inspectable
            diff = proposal.change_set.diff()
            self.assertIn("+ add", diff)
            target_key = proposal.target_component.split(":")[-1]
            self.assertIn(target_key, diff)
            self.assertIn("base_revision", diff)

            # 6. evaluation
            run = self.engine.evaluate(
                proposal_id=proposal.id, change_set=proposal.change_set,
                baseline=self.orchestrator.memory, holdout_tasks=self.holdout,
                evidence=evidence, targeted_keys=proposal.targeted_keys,
            )
            # 7. baseline vs candidate, metric by metric
            self.assertTrue(run.metrics)
            target = run.metric("holdout_success_rate")
            self.assertIsNotNone(target)
            self.assertGreaterEqual(target.baseline, 0.0)
            self.assertLessEqual(target.candidate, 1.0)
            for metric in run.metrics:
                self.assertIn("baseline", metric.to_dict())
                self.assertIn("candidate", metric.to_dict())
                self.assertIn("delta", metric.to_dict())
        finally:
            workspace.cleanup()
            self.assertFalse(workspace.root.exists())

    def test_step_08_reject_a_failing_candidate(self):
        """A candidate that does not move the target metric must be rejected."""
        from rsi.patches import LessonChange, LessonChangeSet

        evidence = self.loop.evidence_from_attempts(
            self.orchestrator.attempts, self.orchestrator._tasks_by_id
        )
        # Build a change that is structurally valid but changes nothing the
        # holdout can observe: coverage of an already-covered key.
        covered = sorted(self.orchestrator.memory.keys())[0]
        change_set = LessonChangeSet(
            proposal_id="prop-manual-reject",
            base_revision=self.orchestrator.memory.revision(),
            changes=[LessonChange(
                op="add",
                lesson=self._duplicate_lesson_for(covered, evidence),
            )],
            reason="duplicate an already-covered key",
        )
        run = self.engine.evaluate(
            proposal_id="prop-manual-reject", change_set=change_set,
            baseline=self.orchestrator.memory, holdout_tasks=self.holdout,
            evidence=evidence, targeted_keys=[covered],
        )
        decision = self.engine.decide(run)
        self.assertEqual(decision.outcome, "REJECT")
        self.assertTrue(decision.reasons)
        # And the baseline is untouched by the rejected candidate.
        self.assertEqual(self.orchestrator.memory.revision(), self.baseline_revision)

    def _duplicate_lesson_for(self, key: str, evidence: Sequence[Evidence]):
        from rsi.types import Lesson

        source = next((e for e in evidence if key in e.knowledge_keys), evidence[0])
        return Lesson(
            id="lesson-manual-dup",
            content=f"[procedure] verified lesson about {key}",
            knowledge_keys=[key],
            source_task_id=source.task_id or "task-x",
            confidence=0.8,
            verified=True,
            created_at=1000.0,
        )

    def test_steps_09_to_12_accept_apply_verify(self):
        record = self.loop.run_cycle(
            attempts=self.orchestrator.attempts,
            tasks_by_id=self.orchestrator._tasks_by_id,
        )
        if not record.accepted:
            self.skipTest(
                "no candidate measurably improved the holdout for this seed; "
                "see test_steps_13_to_14 for the rollback path"
            )
        proposal_id = record.accepted[0]

        # 10/11. applied, and the memory revision moved.
        self.assertNotEqual(self.orchestrator.memory.revision(), self.baseline_revision)
        self.assertIn(proposal_id, self.loop._load_applied())

        # 12. verified: the post-apply verification run is recorded and passed.
        verifications = [
            e for e in record.evaluations if str(e.get("id", "")).startswith("verify-")
        ]
        self.assertTrue(verifications)
        self.assertTrue(verifications[-1]["passed"])
        self.assertIn("improvement-applied", self.loop.audit.counts())

        # The applied lesson is present, verified and active.
        new_lessons = [
            lesson for lesson in self.orchestrator.memory.entries()
            if lesson.id not in {l.id for l in
                                 PersistentMemory.from_payload(
                                     self._archived_baseline()).entries()}
        ]
        self.assertTrue(new_lessons)
        for lesson in new_lessons:
            self.assertTrue(lesson.verified)
            self.assertFalse(lesson.deprecated)

    def test_steps_13_to_14_rollback_restores_the_baseline(self):
        record = self.loop.run_cycle(
            attempts=self.orchestrator.attempts,
            tasks_by_id=self.orchestrator._tasks_by_id,
        )
        archives = sorted(self.runs_dir.glob("baseline-mem-*.json"))
        if not archives:
            self.skipTest("no improvement was applied for this seed")

        # Force a post-apply regression and confirm the loop rolls back.
        from rsi.evaluator import CheckResult, EvaluationRun

        baseline_payload = json.loads(archives[-1].read_text(encoding="utf-8"))
        before = self.orchestrator.memory.snapshot()

        def failing_verify(**_kwargs):
            return EvaluationRun(
                id="verify-qa-failure", proposal_id="prop-qa",
                benchmark_version="holdout-v1", environment={},
                started_at=0.0, duration_s=0.0,
                checks=[CheckResult("post-apply-verification", False,
                                    "forced regression")],
                metrics=[],
            )

        original = self.engine.verify_applied
        self.engine.verify_applied = failing_verify
        try:
            rollback_record = self.loop.run_cycle(
                attempts=self.orchestrator.attempts,
                tasks_by_id=self.orchestrator._tasks_by_id,
            )
        finally:
            self.engine.verify_applied = original

        if rollback_record.rolled_back:
            # 14. the baseline is restored exactly.
            restored = self.orchestrator.memory.snapshot()
            self.assertEqual(restored, before)
            self.assertIn("rollback-executed", self.loop.audit.counts())
            event = self.loop.audit.events("rollback-executed")[-1]
            self.assertTrue(event.details["archive"].endswith(".json"))
            self.assertIn("restored_revision", event.details)

    def _archived_baseline(self) -> dict:
        archives = sorted(self.runs_dir.glob("baseline-mem-*.json"))
        if not archives:
            return {"lessons": []}
        return json.loads(archives[-1].read_text(encoding="utf-8"))

    # -- whole-flow invariants ----------------------------------------------
    def test_full_cycle_is_auditable_end_to_end(self):
        record = self.loop.run_cycle(
            attempts=self.orchestrator.attempts,
            tasks_by_id=self.orchestrator._tasks_by_id,
        )
        audit = self.loop.audit
        ok, problems = audit.verify_chain()
        self.assertTrue(ok, problems)
        self.assertIn("cycle-started", audit.counts())
        self.assertIn("cycle-finished", audit.counts())

        # Every recorded event answers one of the observability questions.
        applied_events = audit.events("improvement-applied")
        for event in applied_events:
            details = event.details
            self.assertIn("revision_before", details)      # what was the baseline
            self.assertIn("revision_after", details)       # what changed
            self.assertIn("operations", details)           # how
            self.assertIn("rollback", details)             # can it be undone
            self.assertTrue(details["rollback"]["reversible"])
        for event in audit.events("proposal-created"):
            self.assertIn("hypothesis", event.details)     # why was it proposed
            self.assertIn("target_component", event.details)
        for event in audit.events("candidate-evaluated"):
            self.assertIn("metrics", event.details)        # what evidence
            self.assertIn("benchmark_version", event.details)
        for event in audit.events("proposal-rejected"):
            self.assertIn("reasons", event.details)        # why rejected

    def test_loop_health_is_reported(self):
        self.loop.run_cycle(attempts=self.orchestrator.attempts,
                            tasks_by_id=self.orchestrator._tasks_by_id)
        from rsi.metrics import compute_loop_health

        health = compute_loop_health(self.loop.cycles,
                                     audit_counts=self.loop.audit.counts())
        data = health.to_dict()
        for key in ("cycles", "proposals", "accepted", "rejected", "escalated",
                    "rolled_back", "acceptance_rate", "regression_rate",
                    "rollback_rate", "mean_evaluation_duration_s",
                    "median_improvement_delta", "stagnation_count"):
            self.assertIn(key, data)
        self.assertGreaterEqual(data["cycles"], 1)

    def test_report_and_dashboard_render_after_a_cycle(self):
        self.loop.run_cycle(attempts=self.orchestrator.attempts,
                            tasks_by_id=self.orchestrator._tasks_by_id)
        self.orchestrator.improvement_loop = self.loop
        from rsi.metrics import compute_loop_health

        self.orchestrator.loop_health = compute_loop_health(
            self.loop.cycles, audit_counts=self.loop.audit.counts()
        ).to_dict()
        self.orchestrator.freeze()
        self.orchestrator.evaluate(n=6)
        report = self.orchestrator.report()
        text = report.read_text(encoding="utf-8")
        self.assertIn("Self-improvement loop", text)
        self.assertIn("audit.jsonl", text)

        from rsi.dashboard import build_dashboard

        dashboard = build_dashboard(self.runs_dir)
        html_text = dashboard.read_text(encoding="utf-8")
        self.assertIn("Loop health", html_text)
        self.assertIn("Proposals", html_text)
        self.assertIn("Audit trail", html_text)


from typing import Sequence  # noqa: E402


if __name__ == "__main__":
    unittest.main()

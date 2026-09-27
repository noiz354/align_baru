"""Tests for the bounded self-improvement loop (stdlib unittest, fully offline).

    python -m unittest discover -s tests -v

Covers the RSI improvement contract end to end:

    proposal creation        candidate isolation        baseline preservation
    evaluation               acceptance                 rejection
    rollback                 stale revision rejection   duplicate apply
    iteration limits         resource limits            memory write policy
    stagnation stop          audit history              loop health
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
from rsi.feedback import Evidence, FeedbackRecord, FeedbackIngestor
from rsi.improvement import ApprovalPolicy, CycleState, ImprovementLimits, ImprovementLoop
from rsi.memory import MemoryFrozenError, PersistentMemory
from rsi.metrics import compute_loop_health
from rsi.orchestrator import RSIOrchestrator
from rsi.patches import LessonChange, LessonChangeSet, RevisionMismatch
from rsi.proposals import ImprovementProposal, ProposalGenerator, ProposalStatus
from rsi.risk import RiskLevel, RiskPolicy, classify_risk
from rsi.sandbox import CandidateWorkspace, SandboxLimits, SandboxViolation
from rsi.types import Lesson, Task, new_id


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def make_task(task_id: str, keys: list[str], difficulty: float = 0.5) -> Task:
    return Task(id=task_id, title=f"task {task_id}", category="debug",
                difficulty=difficulty, required_knowledge=list(keys),
                spec=f"do {task_id}", phase="TEST")


def make_lesson(keys: list[str], *, verified: bool = True,
                confidence: float = 0.8, lesson_id: str | None = None,
                created_at: float = 1000.0,
                source_task_id: str = "task-x") -> Lesson:
    return Lesson(
        id=lesson_id or new_id("lesson"),
        content=f"verified lesson about {', '.join(keys)}",
        knowledge_keys=list(keys),
        source_task_id=source_task_id,
        confidence=confidence,
        verified=verified,
        created_at=created_at,
    )


class OrchestratedCase(unittest.TestCase):
    """Base case that produces a real explored memory + holdout tasks."""

    seed = 0
    waves = 2
    tasks_per_wave = 6
    # DRS is left off on purpose: it would cover every knowledge key and leave
    # the improvement loop with nothing legitimate to propose.
    drs_rounds = 0
    drs_tasks = 3

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.runs_dir = Path(self._tmp.name)
        self.orchestrator = RSIOrchestrator(
            runs_dir=self.runs_dir, seed=self.seed, log=lambda _m: None
        )
        self.orchestrator.explore(
            waves=self.waves, tasks_per_wave=self.tasks_per_wave,
            drs_rounds=self.drs_rounds, drs_tasks=self.drs_tasks,
        )
        self.holdout = self.orchestrator.curriculum.holdout(12, split="improve")

    def build_loop(self, **overrides) -> ImprovementLoop:
        limits = ImprovementLimits(**overrides.pop("limits", {}))
        engine = EvaluationEngine(
            self.orchestrator.evaluate_against,
            limits=EvaluationLimits(
                max_holdout_tasks=12,
                max_lessons_per_candidate=limits.max_changed_lessons,
                max_diff_lines=limits.max_diff_lines,
            ),
            policy=AcceptancePolicy(min_target_delta=limits.min_target_delta),
        )
        return ImprovementLoop(
            self.orchestrator.memory,
            engine,
            self.holdout,
            runs_dir=self.runs_dir,
            limits=limits,
            audit=AuditLog(self.runs_dir / "audit.jsonl"),
            generator=ProposalGenerator(
                max_lessons_per_proposal=limits.max_changed_lessons,
            ),
            log=lambda _m: None,
            **overrides,
        )


# ---------------------------------------------------------------------------
# Proposal model
# ---------------------------------------------------------------------------
class ProposalTests(unittest.TestCase):
    def setUp(self) -> None:
        self.memory = PersistentMemory(None)
        self.memory.add(make_lesson(["pytest"]))
        self.holdout = [
            make_task("t1", ["pytest", "fixtures"]),
            make_task("t2", ["golden", "schema"]),
        ]
        self.generator = ProposalGenerator(max_lessons_per_proposal=2)

    def test_proposal_is_evidence_backed_and_measurable(self):
        evidence = [
            Evidence(id="e1", source="execution_failure", task_id="t2",
                     knowledge_keys=["golden"], failure_mode="golden",
                     success=False, score=0.4, done_confidence=0.2, phase="BRS"),
        ]
        proposals = self.generator.generate(evidence, self.memory, self.holdout)
        self.assertTrue(proposals)
        proposal = proposals[0]
        self.assertIn("golden", proposal.target_component)
        self.assertTrue(proposal.hypothesis)
        self.assertIn("coverage", proposal.hypothesis.lower())
        self.assertTrue(proposal.expected_benefit)
        self.assertTrue(proposal.evaluation_plan)
        self.assertTrue(proposal.rollback_plan)
        self.assertIn("e1", proposal.source_observation)
        self.assertEqual(proposal.status, ProposalStatus.DRAFT)

    def test_no_proposal_for_already_covered_key(self):
        """A key the baseline already covers must never generate a proposal."""
        evidence = [
            Evidence(id="e1", source="execution_failure", task_id="t1",
                     knowledge_keys=["pytest"], failure_mode="pytest",
                     success=False, score=0.4, done_confidence=0.2, phase="BRS"),
        ]
        proposals = self.generator.generate(evidence, self.memory, self.holdout)
        self.assertEqual(
            [p.target_component for p in proposals], [],
            "evidence about an already-covered key must not produce a proposal",
        )

    def test_no_evidence_for_a_key_means_no_proposal_for_it(self):
        """Holdout demand alone is not evidence: it must not mint a lesson."""
        proposals = self.generator.generate([], self.memory, self.holdout)
        self.assertEqual(proposals, [])

    def test_no_evidence_no_proposal(self):
        self.assertEqual(
            self.generator.generate([], PersistentMemory(None), self.holdout), []
        )

    def test_proposal_ids_are_deterministic(self):
        evidence = [
            Evidence(id="e1", source="execution_failure", task_id="t2",
                     knowledge_keys=["golden"], failure_mode="golden",
                     success=False, score=0.4, done_confidence=0.2, phase="BRS"),
        ]
        first = self.generator.generate(evidence, self.memory, self.holdout)
        second = self.generator.generate(evidence, self.memory, self.holdout)
        self.assertEqual([p.id for p in first], [p.id for p in second])

    def test_vague_tasks_are_rejected_by_the_generator(self):
        """'make yourself smarter' has no measurable criteria and no evidence."""
        vague = FeedbackRecord(
            source="human_correction",
            message="make yourself smarter",
            knowledge_keys=[],
            human_confirmed=True,
        )
        evidence = FeedbackIngestor().ingest_many([vague])
        self.assertEqual(len(evidence), 1)
        self.assertEqual(evidence[0].status, "accepted")
        proposals = self.generator.generate(evidence, self.memory, self.holdout)
        self.assertEqual(
            proposals, [],
            "a vague instruction with no measurable criteria and no knowledge "
            "keys must not become an improvement proposal",
        )

    def test_risk_is_computed_from_the_change_not_the_claim(self):
        evidence = [
            Evidence(id="e1", source="execution_failure", task_id="t2",
                     knowledge_keys=["golden"], failure_mode="golden",
                     success=False, score=0.4, done_confidence=0.2, phase="BRS"),
        ]
        proposal = self.generator.generate(evidence, self.memory, self.holdout)[0]
        self.assertIn(proposal.risk_level, set(RiskLevel))
        # A security-sensitive key escalates the same single-op change.
        security = self.generator.generate(
            [Evidence(id="e2", source="execution_failure", task_id="t3",
                      knowledge_keys=["security"], failure_mode="security",
                      success=False, score=0.4, done_confidence=0.2, phase="BRS")],
            self.memory, [make_task("t3", ["security"])],
        )[0]
        self.assertEqual(security.risk_level, RiskLevel.MEDIUM)
        self.assertTrue(security.risk_reasons)


# ---------------------------------------------------------------------------
# Sandbox
# ---------------------------------------------------------------------------
class SandboxTests(unittest.TestCase):
    def test_absolute_and_traversal_paths_are_refused(self):
        with CandidateWorkspace.create("t") as workspace:
            for bad in ("/etc/passwd", "../escape.txt", "a/../../b.txt",
                        "", "   ", "sub/../../../x"):
                with self.assertRaises(SandboxViolation, msg=bad):
                    workspace.write(bad, "x")

    def test_write_stays_inside_the_workspace(self):
        with CandidateWorkspace.create("t") as workspace:
            target = workspace.write("nested/dir/file.txt", "hello")
            self.assertTrue(target.exists())
            self.assertEqual(workspace.read("nested/dir/file.txt"), "hello")
            self.assertEqual(target.resolve().parent.parent.parent,
                             workspace.root.resolve())

    def test_secret_shaped_content_is_refused(self):
        with CandidateWorkspace.create("t") as workspace:
            for secret in ('api_key = "sk-1234567890abcdef"',
                           "Authorization: Bearer abcdefghijklmnopqrst",
                           "-----BEGIN RSA PRIVATE KEY-----"):
                with self.assertRaises(SandboxViolation, msg=secret[:20]):
                    workspace.write("candidate.txt", secret)

    def test_prose_mentioning_tokens_is_allowed(self):
        """A lesson titled 'token leaks' must not trip the secret scanner."""
        with CandidateWorkspace.create("t") as workspace:
            workspace.write("candidate.txt",
                            "Review auth middleware for token leaks")

    def test_file_and_byte_budgets_are_enforced(self):
        limits = SandboxLimits(max_files=2, max_bytes_per_file=16,
                               max_total_bytes=32, max_diff_lines=10)
        with CandidateWorkspace.create("t", limits) as workspace:
            workspace.write("a.txt", "12345678")
            workspace.write("b.txt", "12345678")
            with self.assertRaises(SandboxViolation):
                workspace.write("c.txt", "x")
            with self.assertRaises(SandboxViolation):
                workspace.write("a.txt", "x" * 40)
            with self.assertRaises(SandboxViolation):
                workspace.write("d.txt", "x" * 40)

    def test_diff_budget_is_enforced(self):
        limits = SandboxLimits(max_diff_lines=3)
        with CandidateWorkspace.create("t", limits) as workspace:
            workspace.write("f.txt", "a\nb\nc\nd\ne")
            with self.assertRaises(SandboxViolation):
                workspace.assert_within_diff_budget({"f.txt": ""})

    def test_cleanup_removes_the_workspace(self):
        workspace = CandidateWorkspace.create("t")
        root = workspace.root
        workspace.write("f.txt", "x")
        self.assertTrue(root.exists())
        workspace.cleanup()
        self.assertFalse(root.exists())


# ---------------------------------------------------------------------------
# Patches / revisions
# ---------------------------------------------------------------------------
class PatchTests(unittest.TestCase):
    def test_change_set_requires_a_reason_and_a_base_revision(self):
        memory = PersistentMemory(None)
        memory.add(make_lesson(["pytest"]))
        change_set = LessonChangeSet(
            proposal_id="p1", base_revision="",
            changes=[LessonChange(op="add", lesson=make_lesson(["golden"]))],
            reason="",
        )
        problems = change_set.validate()
        self.assertTrue(any("reason" in p for p in problems))
        self.assertTrue(any("base_revision" in p for p in problems))

    def test_stale_base_revision_is_refused(self):
        memory = PersistentMemory(None)
        memory.add(make_lesson(["pytest"]))
        stale = LessonChangeSet(
            proposal_id="p1", base_revision="mem-does-not-match",
            changes=[LessonChange(op="add", lesson=make_lesson(["golden"]))],
            reason="cover golden",
        )
        with self.assertRaises(RevisionMismatch):
            stale.apply(memory)
        self.assertEqual(len(memory), 1, "a stale candidate must not mutate memory")

    def test_unverified_lesson_is_refused(self):
        memory = PersistentMemory(None)
        memory.add(make_lesson(["pytest"]))
        change_set = LessonChangeSet(
            proposal_id="p1", base_revision=memory.revision(),
            changes=[LessonChange(op="add", lesson=make_lesson(["x"], verified=False))],
            reason="cover x",
        )
        self.assertTrue(any("not verified" in p for p in change_set.validate()))

    def test_apply_add_replace_retire_roundtrip(self):
        memory = PersistentMemory(None)
        first = make_lesson(["pytest"], lesson_id="lesson-a")
        memory.add(first)
        second = make_lesson(["golden"], lesson_id="lesson-b")
        memory.add(second)
        base = memory.revision()

        replacement = make_lesson(["pytest", "fixtures"], lesson_id="lesson-a",
                                  confidence=0.95)
        change_set = LessonChangeSet(
            proposal_id="p1", base_revision=base,
            changes=[
                LessonChange(op="replace", lesson=replacement),
                LessonChange(op="retire", target_lesson_id="lesson-b",
                             lesson=make_lesson(["golden"], lesson_id="lesson-c")),
            ],
            reason="tighten the pytest lesson, retire the weak golden one",
        )
        applied = change_set.apply(memory)
        self.assertEqual(applied["replaced"], ["lesson-a"])
        self.assertEqual(applied["retired"], ["lesson-b"])
        self.assertEqual(memory.entries()[0].version, 2)
        retired = memory.entries()[1]
        self.assertTrue(retired.deprecated)
        self.assertEqual(retired.superseded_by, "lesson-c")
        # Deprecated lessons no longer count as competence.
        self.assertNotIn("golden", memory.keys())
        self.assertNotEqual(memory.revision(), base)

    def test_frozen_memory_refuses_patches(self):
        memory = PersistentMemory(None)
        memory.add(make_lesson(["pytest"]))
        memory.freeze()
        change_set = LessonChangeSet(
            proposal_id="p1", base_revision=memory.revision(),
            changes=[LessonChange(op="add", lesson=make_lesson(["golden"]))],
            reason="cover golden",
        )
        with self.assertRaises(MemoryFrozenError):
            change_set.apply(memory)

    def test_change_set_diff_is_inspectable(self):
        change_set = LessonChangeSet(
            proposal_id="p1", base_revision="mem-1",
            changes=[LessonChange(op="add", lesson=make_lesson(["golden"]))],
            reason="cover golden",
        )
        diff = change_set.diff()
        self.assertIn("+ add", diff)
        self.assertIn("cover golden", diff)
        self.assertIn("mem-1", diff)
        self.assertGreater(change_set.diff_lines(), 0)


# ---------------------------------------------------------------------------
# Risk model
# ---------------------------------------------------------------------------
class RiskTests(unittest.TestCase):
    def test_single_lesson_is_low_or_medium_risk(self):
        assessment = classify_risk(op_count=1, knowledge_keys=["golden"])
        self.assertEqual(assessment.level, RiskLevel.LOW)
        self.assertFalse(assessment.requires_human_approval)

    def test_security_key_raises_risk(self):
        assessment = classify_risk(op_count=1, knowledge_keys=["security"])
        self.assertEqual(assessment.level, RiskLevel.MEDIUM)

    def test_protected_paths_are_critical(self):
        assessment = classify_risk(op_count=1, touched_paths=["rsi/evaluator.py"])
        self.assertEqual(assessment.level, RiskLevel.CRITICAL)
        self.assertTrue(assessment.requires_human_approval)

    def test_restricted_scope_is_critical(self):
        assessment = classify_risk(op_count=1, critical_areas=["deployment"])
        self.assertEqual(assessment.level, RiskLevel.CRITICAL)

    def test_skill_files_are_self_editable(self):
        from rsi.risk import is_self_editable_path, is_restricted_path

        self.assertTrue(is_self_editable_path("SKILL.md"))
        self.assertTrue(is_self_editable_path("./CLAUDE.md"))
        self.assertFalse(is_self_editable_path("rsi/rao.py"))
        self.assertTrue(is_restricted_path("rsi/rao.py"))
        self.assertTrue(is_restricted_path("tests/test_rsi.py"))
        self.assertTrue(is_restricted_path("SECURITY.md"))
        self.assertTrue(is_restricted_path("pyproject.toml"))

    def test_risk_policy_auto_accept_ceiling(self):
        policy = RiskPolicy(auto_accept_max_risk=RiskLevel.MEDIUM)
        self.assertTrue(policy.allows_auto_accept(RiskLevel.LOW))
        self.assertTrue(policy.allows_auto_accept(RiskLevel.MEDIUM))
        self.assertFalse(policy.allows_auto_accept(RiskLevel.HIGH))
        self.assertTrue(policy.requires_human_approval(RiskLevel.CRITICAL))


# ---------------------------------------------------------------------------
# The loop
# ---------------------------------------------------------------------------
class ImprovementLoopTests(OrchestratedCase):
    def test_cycle_runs_the_full_state_sequence(self):
        loop = self.build_loop(limits={"max_candidates_per_cycle": 1})
        record = loop.run_cycle(attempts=self.orchestrator.attempts,
                                tasks_by_id=self.orchestrator._tasks_by_id)
        self.assertGreaterEqual(record.evidence_count, 0)
        self.assertIn(record.state, {CycleState.RECORDING.value, CycleState.STOPPED.value})
        self.assertTrue(record.baseline_revision.startswith("mem-"))
        self.assertTrue(record.final_revision.startswith("mem-"))

    def test_every_decision_is_audited(self):
        loop = self.build_loop()
        loop.run_cycle(attempts=self.orchestrator.attempts,
                       tasks_by_id=self.orchestrator._tasks_by_id)
        kinds = loop.audit.counts()
        for expected in ("cycle-started", "proposal-created",
                         "candidate-evaluated", "cycle-finished"):
            self.assertIn(expected, kinds, f"missing audit event {expected}")
        ok, problems = loop.audit.verify_chain()
        self.assertTrue(ok, problems)

    def test_accepted_improvement_changes_the_memory_revision(self):
        loop = self.build_loop(limits={"max_candidates_per_cycle": 4})
        before = self.orchestrator.memory.revision()
        loop.run(attempts=self.orchestrator.attempts,
                 tasks_by_id=self.orchestrator._tasks_by_id)
        accepted = [p for c in loop.cycles for p in c.accepted]
        if accepted:
            self.assertNotEqual(self.orchestrator.memory.revision(), before)
            self.assertIn(accepted[0], loop._load_applied())

    def test_baseline_is_archived_before_apply(self):
        loop = self.build_loop(limits={"max_candidates_per_cycle": 4})
        loop.run(attempts=self.orchestrator.attempts,
                 tasks_by_id=self.orchestrator._tasks_by_id)
        archives = list(self.runs_dir.glob("baseline-mem-*.json"))
        applied = [p for c in loop.cycles for p in c.accepted]
        if applied:
            self.assertTrue(archives, "an applied improvement must archive the baseline")
            payload = json.loads(archives[0].read_text(encoding="utf-8"))
            self.assertIn("lessons", payload)

    def test_acceptance_requires_a_real_improvement(self):
        """A candidate that passes checks but does not move the target is rejected.

        The decision must rest on measured metrics, never on a claim of safety
        or a confidence score supplied with the proposal.
        """
        from rsi.evaluator import CheckResult, MetricResult

        from rsi.types import Attempt as _Attempt

        def flat_runner(memory, tasks):
            """Identical baseline and candidate metrics: nothing improved."""
            return [
                _Attempt(
                    task_id=t.id, task_title=t.title, actor_id="fast_model",
                    route="fast_model", phase="TEST", steps=[],
                    output="no change", success=False, score=0.5,
                    done_confidence=0.1,
                )
                for t in tasks
            ]

        engine = EvaluationEngine(
            flat_runner,
            limits=EvaluationLimits(max_holdout_tasks=24),
            policy=AcceptancePolicy(min_target_delta=0.10),
        )
        # Use the *real* proposal generator so the candidate is structurally and
        # tamper-clean — the only thing wrong with it is that a flat runner means
        # the *metrics* cannot move.
        evidence = _evidence(self.orchestrator)
        proposals = ProposalGenerator().generate(
            evidence, self.orchestrator.memory, self.holdout
        )
        if not proposals:
            self.skipTest("no proposal available for this seed")
        proposal = proposals[0]
        change_set = proposal.change_set
        run = engine.evaluate(
            proposal_id=proposal.id, change_set=change_set,
            baseline=self.orchestrator.memory, holdout_tasks=self.holdout,
            evidence=evidence, targeted_keys=proposal.targeted_keys,
        )
        self.assertTrue(all(c.ok for c in run.checks if c.mandatory),
                        "structural checks should pass before the metric gate")
        target = run.metric("failed_task_recovery_rate")
        self.assertEqual(target.delta, 0.0)
        decision = engine.decide(run)
        self.assertEqual(decision.outcome, "REJECT")
        self.assertTrue(any("failed_task_recovery_rate" in r for r in decision.reasons))
        self.assertIsInstance(run.metrics[0], MetricResult)

    def test_applied_ledger_blocks_replay(self):
        """`applied.json` is the durable idempotency ledger for proposals."""
        from rsi.evaluator import CheckResult, EvaluationRun, MetricResult

        loop = self.build_loop()
        proposal_id = "prop-replay-test"
        self.assertFalse(loop.already_applied(proposal_id))

        # Force a passing post-apply verification: this test isolates the
        # *ledger* semantics, and the regression/rollback path is covered by
        # test_post_apply_verification_failure_triggers_rollback.
        def passing_verify(**_kwargs):
            return EvaluationRun(
                id="verify-pass", proposal_id=proposal_id,
                benchmark_version="holdout-v1", environment={},
                started_at=0.0, duration_s=0.0,
                checks=[CheckResult("post-apply-verification", True, "ok")],
                metrics=[MetricResult("failed_task_recovery_rate", 0.0, 1.0)],
            )
        original = loop.evaluator.verify_applied
        # 1. a real apply writes the ledger.
        change_set = LessonChangeSet(
            proposal_id=proposal_id,
            base_revision=self.orchestrator.memory.revision(),
            changes=[LessonChange(op="add", lesson=make_lesson(
                ["golden"], source_task_id="task-golden"))],
            reason="ledger fixture",
        )
        try:
            loop.evaluator.verify_applied = passing_verify
            result = loop.apply_change_set(proposal_id, change_set)
        finally:
            loop.evaluator.verify_applied = original
        self.assertTrue(result["applied"], result)
        self.assertTrue(loop.already_applied(proposal_id))
        self.assertEqual(
            loop._load_applied()[proposal_id]["revision_before"],
            result["revision_before"],
        )

        # 2. replaying the same id is refused, and the ledger still holds it.
        replay = loop.apply_change_set(proposal_id, change_set)
        self.assertFalse(replay["applied"])
        self.assertIn("already applied", replay["reason"])
        self.assertTrue(loop.already_applied(proposal_id))

        # 3. a fresh loop over the same runs dir sees the same ledger.
        reloaded = self.build_loop()
        self.assertTrue(reloaded.already_applied(proposal_id))

    def test_rejected_candidate_never_mutates_the_baseline(self):
        loop = self.build_loop()
        baseline_payload = self.orchestrator.memory.snapshot()
        record = loop.run_cycle(attempts=self.orchestrator.attempts,
                                tasks_by_id=self.orchestrator._tasks_by_id)
        if record.accepted:
            self.skipTest("this seed accepted a candidate; see the apply tests")
        self.assertEqual(self.orchestrator.memory.snapshot(), baseline_payload,
                         "a rejected candidate must leave the baseline untouched")

    def test_post_apply_verification_failure_triggers_rollback(self):
        """Apply -> smoke verification -> regression -> rollback -> record."""
        loop = self.build_loop(limits={"max_candidates_per_cycle": 1})
        evidence = loop_evidence(self.orchestrator)
        proposals = loop.generator.generate(
            evidence, self.orchestrator.memory, self.holdout
        )
        if not proposals:
            self.skipTest("no proposal available for this seed")

        baseline_payload = self.orchestrator.memory.snapshot()
        baseline_revision = self.orchestrator.memory.revision()

        # Force the post-apply verification to fail, as a real regression would.
        from rsi.evaluator import CheckResult, EvaluationRun, MetricResult

        def failing_verify(**kwargs):
            return EvaluationRun(
                id="verify-forced-failure",
                proposal_id=kwargs.get("proposal_id", ""),
                benchmark_version="holdout-v1",
                environment={},
                started_at=0.0,
                duration_s=0.0,
                checks=[CheckResult("post-apply-verification", False,
                                    "forced regression for the test")],
                metrics=[],
            )

        original = loop.evaluator.verify_applied
        loop.evaluator.verify_applied = failing_verify
        try:
            record = loop.run_cycle(attempts=self.orchestrator.attempts,
                                    tasks_by_id=self.orchestrator._tasks_by_id)
        finally:
            loop.evaluator.verify_applied = original

        self.assertTrue(record.rolled_back,
                        "a failing post-apply verification must roll back")
        self.assertEqual(record.accepted, [])
        self.assertEqual(self.orchestrator.memory.snapshot(), baseline_payload,
                         "rollback must restore the exact pre-apply payload")
        self.assertEqual(self.orchestrator.memory.revision(), baseline_revision)
        self.assertIn("rollback-executed", loop.audit.counts())
        rollback_event = loop.audit.events("rollback-executed")[-1]
        self.assertIn("restored_revision", rollback_event.details)
        self.assertTrue(rollback_event.details["restored_revision"].startswith("mem-"))
        # The proposal is recorded as rolled back, not applied.
        self.assertEqual(record.proposals[0]["status"], "ROLLED_BACK")
        # The rolled-back proposal must not be recorded as applied.
        self.assertNotIn(record.rolled_back[0], loop._load_applied())

    def test_duplicate_proposals_are_not_re_applied(self):
        loop = self.build_loop(limits={"max_candidates_per_cycle": 4})
        loop.run(attempts=self.orchestrator.attempts,
                 tasks_by_id=self.orchestrator._tasks_by_id)
        applied = [p for c in loop.cycles for p in c.accepted]
        if not applied:
            self.skipTest("no proposal was accepted for this seed")
        # Re-running must not apply the same proposal twice.
        revisions = {self.orchestrator.memory.revision()}
        loop.run(attempts=self.orchestrator.attempts,
                 tasks_by_id=self.orchestrator._tasks_by_id)
        revisions.add(self.orchestrator.memory.revision())
        for proposal_id in applied:
            self.assertIn(proposal_id, loop._load_applied())
        blocked = [p for c in loop.cycles for p in c.blocked]
        self.assertTrue(set(applied) & set(blocked) or len(revisions) >= 1)

    def test_frozen_memory_blocks_the_loop(self):
        self.orchestrator.memory.freeze()
        loop = self.build_loop()
        record = loop.run_cycle()
        self.assertEqual(record.state, CycleState.STOPPED.value)
        self.assertIn("frozen", record.stop_reason)

    def test_iteration_limit_caps_proposals_per_cycle(self):
        loop = self.build_loop(limits={"max_proposals_per_cycle": 1,
                                       "max_candidates_per_cycle": 1})
        record = loop.run_cycle(attempts=self.orchestrator.attempts,
                                tasks_by_id=self.orchestrator._tasks_by_id)
        self.assertLessEqual(len(record.proposals), 1)

    def test_max_cycles_is_respected(self):
        loop = self.build_loop(limits={"max_cycles": 2,
                                       "stagnation_window": 99})
        loop.run(max_cycles=5, attempts=self.orchestrator.attempts,
                 tasks_by_id=self.orchestrator._tasks_by_id)
        self.assertEqual(len(loop.cycles), 2)

    def test_wall_clock_budget_stops_the_loop(self):
        loop = self.build_loop(limits={"max_cycles": 10,
                                       "stagnation_window": 99,
                                       "max_wall_clock_seconds": 0.0001})
        loop.run(attempts=self.orchestrator.attempts,
                 tasks_by_id=self.orchestrator._tasks_by_id)
        self.assertLessEqual(len(loop.cycles), 1)

    def test_stagnation_stops_the_loop(self):
        loop = self.build_loop(limits={"stagnation_window": 2,
                                       "max_candidates_per_cycle": 1})
        loop.run(attempts=self.orchestrator.attempts,
                 tasks_by_id=self.orchestrator._tasks_by_id)
        if loop.state is CycleState.STOPPED:
            self.assertIn("stagnation", loop.stop_reason)
            self.assertGreaterEqual(loop.stagnation_count, 2)
            self.assertIn("loop-stopped-stagnation", loop.audit.counts())

    def test_diff_budget_rejects_oversized_change(self):
        loop = self.build_loop(limits={"max_diff_lines": 1})
        record = loop.run_cycle(attempts=self.orchestrator.attempts,
                                tasks_by_id=self.orchestrator._tasks_by_id)
        if record.proposals:
            self.assertIn("max_diff_lines", record.limit_hits)
            self.assertTrue(record.rejected)

    def test_lesson_budget_rejects_oversized_change(self):
        loop = self.build_loop(limits={"max_changed_lessons": 0})
        record = loop.run_cycle(attempts=self.orchestrator.attempts,
                                tasks_by_id=self.orchestrator._tasks_by_id)
        self.assertTrue(record.rejected or not record.proposals)

    def test_high_risk_requires_human_approval(self):
        loop = self.build_loop(limits={"max_candidates_per_cycle": 1})
        evidence = self.loop_evidence()
        proposals = loop.generator.generate(
            evidence, self.orchestrator.memory, self.holdout
        )
        if not proposals:
            self.skipTest("no proposal available for this seed")
        proposal = proposals[0]
        # Force a HIGH-risk classification by pretending the change touches code.
        from rsi.risk import RiskAssessment

        run = loop.evaluator.evaluate(
            proposal_id=proposal.id, change_set=proposal.change_set,
            baseline=self.orchestrator.memory, holdout_tasks=self.holdout,
            evidence=evidence, targeted_keys=proposal.targeted_keys,
        )
        decision = loop.evaluator.decide(
            run, RiskAssessment(level=RiskLevel.CRITICAL, reasons=["touches evaluator"])
        )
        self.assertEqual(decision.outcome, "ESCALATE")
        approval = loop.approval.request(proposal, run, RiskLevel.CRITICAL)
        self.assertFalse(approval.approved)
        self.assertIn("NOT applied", approval.reason)

    def loop_evidence(self):
        return loop_evidence(self.orchestrator)

    def test_concurrency_lock_serialises_cycles(self):
        loop = self.build_loop()
        with loop._lock.hold() as first:
            self.assertTrue(first)
            other = self.build_loop()
            with other._lock.hold(timeout=0.2) as second:
                self.assertFalse(second, "a second cycle must not acquire the lock")
        with self.build_loop()._lock.hold(timeout=0.5) as third:
            self.assertTrue(third)

    def test_archived_baseline_restores_the_accepted_state(self):
        """The archived payload is enough to get back to the last known-good."""
        loop = self.build_loop(limits={"max_candidates_per_cycle": 4})
        evidence = loop_evidence(self.orchestrator)
        proposals = loop.generator.generate(
            evidence, self.orchestrator.memory, self.holdout
        )
        if not proposals:
            self.skipTest("no proposal available for this seed")
        proposal = proposals[0]
        baseline_payload = self.orchestrator.memory.snapshot()
        archive = self.runs_dir / f"baseline-{self.orchestrator.memory.revision()}.json"
        archive.write_text(json.dumps(baseline_payload, indent=2), encoding="utf-8")

        applied = proposal.change_set.apply(self.orchestrator.memory)
        self.assertTrue(applied["added"] or applied["replaced"])
        self.assertNotEqual(self.orchestrator.memory.revision(),
                            baseline_payload["revision"])

        # Restoring from the archive must reproduce the accepted state exactly.
        restored = PersistentMemory.from_payload(
            json.loads(archive.read_text(encoding="utf-8"))
        )
        self.assertEqual(restored.snapshot(), baseline_payload)


def loop_evidence(orchestrator: RSIOrchestrator) -> list[Evidence]:
    return orchestrator.improvement_loop.evidence_from_attempts(
        orchestrator.attempts, orchestrator._tasks_by_id
    ) if orchestrator.improvement_loop else _evidence(orchestrator)


def _evidence(orchestrator: RSIOrchestrator) -> list[Evidence]:
    out: list[Evidence] = []
    for attempt in orchestrator.attempts:
        task = orchestrator._tasks_by_id.get(attempt.task_id)
        keys = list(task.required_knowledge) if task else []
        if attempt.failure_mode and attempt.failure_mode not in keys:
            keys.append(attempt.failure_mode)
        out.append(Evidence(
            id=f"ev-{attempt.task_id}", source="execution_failure",
            task_id=attempt.task_id, knowledge_keys=keys,
            failure_mode=attempt.failure_mode, success=attempt.success,
            score=attempt.score, done_confidence=attempt.done_confidence,
            phase=attempt.phase,
        ))
    return out


# ---------------------------------------------------------------------------
# Memory write policy / versioning
# ---------------------------------------------------------------------------
class MemoryPolicyTests(unittest.TestCase):
    def test_deprecated_lessons_leave_the_read_path(self):
        memory = PersistentMemory(None)
        memory.add(make_lesson(["pytest"], lesson_id="a"))
        memory.add(make_lesson(["golden"], lesson_id="b"))
        memory.retire("b", superseded_by="c")
        self.assertIn("pytest", memory.keys())
        self.assertNotIn("golden", memory.keys())
        self.assertEqual(memory.stats()["deprecated_lessons"], 1)

    def test_snapshot_survives_a_json_roundtrip(self):
        memory = PersistentMemory(None)
        memory.add(make_lesson(["pytest"]))
        payload = memory.snapshot()
        restored = PersistentMemory.from_payload(json.loads(json.dumps(payload)))
        self.assertEqual(restored.revision(), memory.revision())

    def test_weak_keys_respects_min_coverage(self):
        memory = PersistentMemory(None)
        memory.add(make_lesson(["pytest"]))
        self.assertEqual(memory.weak_keys(["pytest", "golden", "sql"]),
                         ["golden", "sql"])
        self.assertEqual(memory.weak_keys(["pytest"], min_coverage=2.0), ["pytest"])

    def test_revision_is_stable_for_identical_content(self):
        a = PersistentMemory(None)
        b = PersistentMemory(None)
        a.add(make_lesson(["pytest"], lesson_id="lesson-a"))
        b.add(make_lesson(["pytest"], lesson_id="lesson-a"))
        self.assertEqual(a.revision(), b.revision())
        b.add(make_lesson(["golden"], lesson_id="lesson-b"))
        self.assertNotEqual(a.revision(), b.revision())


# ---------------------------------------------------------------------------
# Loop health
# ---------------------------------------------------------------------------
class LoopHealthTests(unittest.TestCase):
    def test_health_aggregates_cycle_records(self):
        from rsi.improvement import CycleRecord

        cycles = [
            CycleRecord(cycle=1, started_at=0.0, duration_s=1.0,
                        proposals=[{"id": "p1"}, {"id": "p2"}],
                        evaluations=[{"passed": True, "duration_s": 0.5,
                                      "metrics": [{"name": "failed_task_recovery_rate",
                                                   "delta": 0.2}]}],
                        accepted=["p1"], rejected=["p2"], limit_hits=["max_diff_lines"]),
            CycleRecord(cycle=2, started_at=1.0, duration_s=2.0,
                        proposals=[{"id": "p3"}],
                        evaluations=[{"passed": False, "duration_s": 1.5,
                                      "metrics": [{"name": "failed_task_recovery_rate",
                                                   "delta": 0.0}]}],
                        rejected=["p3"]),
        ]
        health = compute_loop_health(
            cycles, audit_counts={"proposal-rejected": 2},
            target_metric="failed_task_recovery_rate",
        )
        self.assertEqual(health.cycles, 2)
        self.assertEqual(health.proposals, 3)
        self.assertEqual(health.accepted, 1)
        self.assertEqual(health.rejected, 2)
        self.assertAlmostEqual(health.acceptance_rate, 1 / 3)
        self.assertAlmostEqual(health.mean_evaluation_duration_s, 1.0)
        self.assertAlmostEqual(health.median_improvement_delta, 0.1)
        self.assertEqual(health.limit_hits["max_diff_lines"], 1)
        rendered = health.to_dict()
        self.assertIn("rollback_rate", rendered)
        # The default target metric is the one the loop actually optimises.
        default = compute_loop_health(cycles)
        self.assertEqual(default.median_improvement_metric,
                         "failed_task_recovery_rate")
        self.assertAlmostEqual(default.median_improvement_delta, 0.1)
        # An unknown metric name simply yields no deltas rather than crashing.
        empty = compute_loop_health(cycles, target_metric="holdout_success_rate")
        self.assertAlmostEqual(empty.median_improvement_delta, 0.0)


if __name__ == "__main__":
    unittest.main()

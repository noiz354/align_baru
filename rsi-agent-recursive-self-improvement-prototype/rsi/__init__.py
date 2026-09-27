"""RSI Agent: Recursive Self-Improvement pipeline for coding agents.

Curriculum -> Actor (ReAct) -> Verifier over persistent memory, with Jev
(TypeSafe) as the typed decision model for guardrails, routing, grading and
done-checks. See README.md for the architecture.

The self-modification half of the loop lives in `rsi.improvement`: evidence
becomes proposals, proposals become isolated candidates, candidates are
evaluated against the accepted baseline, and only measurable, non-regressing,
human-approved improvements are applied -- always reversibly.

Module map
----------
    types.py       core dataclasses (Task, Lesson, Attempt, Verdict, ...)
    memory.py      PersistentMemory + revision / snapshot / rollback
    jev.py         typed questions + MockJev / TypeSafeJev
    curriculum.py  CurriculumAgent: BRS / DRS / holdout
    planners.py    Planner protocol, MockPlanner, OpenAICompatPlanner
    tools.py       tool surface (run_tests, read/write, grep)
    harness.py     ReActHarness: Context -> LLM -> Tool -> Memory -> loop
    actor.py       ActorAgent
    verifier.py    VerifierAgent: Jev score + done -> lesson extraction
    routing.py     OrchestrationLayer: Jev guard + Choice routing
    feedback.py    FeedbackRecord -> structured Evidence (DATA vs INSTRUCTIONS)
    risk.py        risk classification + human-approval policy
    sandbox.py     isolated candidate workspace + secret scanning
    patches.py     change sets / file patches + base-revision checks
    audit.py       append-only, hash-chained audit trail
    evaluator.py   evaluation engine + acceptance policy + tamper detection
    proposals.py   ImprovementProposal + evidence-based generator
    improvement.py the bounded improvement loop
    metrics.py     loop-health metrics
    benchmark.py   benchmark command + snapshot diffing
    dashboard.py   static HTML dashboard over runs/
    skills.py      memory -> SKILL.md / CLAUDE.md
    rao.py         RAO loop: self-assess -> rewrite skill files (human-gated)
    orchestrator.py RSIOrchestrator: BRS -> DRS -> freeze -> cold/warm
    cli.py         command-line interface
"""
from .types import Task, Lesson, Attempt, Verdict, Action, SolveResult
from .memory import PersistentMemory, MemoryFrozenError
from .jev import (
    MockJev,
    TypeSafeJev,
    JevClient,
    ChoiceQuestion,
    ScoreQuestion,
    NoulQuestion,
    ChoiceAnswer,
    ScoreAnswer,
    NoulAnswer,
    get_jev,
)
from .curriculum import CurriculumAgent, KNOWLEDGE_KEYS
from .actor import ActorAgent
from .verifier import VerifierAgent
from .routing import OrchestrationLayer, RouteDecision
from .harness import ReActHarness
from .orchestrator import RSIOrchestrator, summarize
from .planners import mock_planner_factory, openai_planner_factory

# Self-improvement layer
from .feedback import FeedbackRecord, FeedbackIngestor, Evidence, FeedbackSource
from .risk import RiskLevel, RiskPolicy, RiskAssessment, classify_risk
from .sandbox import (
    CandidateWorkspace, SandboxLimits, SandboxViolation, SecretLeakViolation,
    assert_no_secrets, redact,
)
from .patches import (
    LessonChange, LessonChangeSet, FilePatch, FileChangeSet, RevisionMismatch,
)
from .audit import AuditLog, AuditEvent
from .evaluator import (
    EvaluationEngine, EvaluationRun, EvaluationLimits, AcceptancePolicy,
    Decision, MetricResult, CheckResult, TamperDetector,
)
from .proposals import ImprovementProposal, ProposalGenerator, ProposalStatus
from .improvement import ImprovementLoop, ImprovementLimits, ApprovalPolicy, CycleState
from .metrics import LoopHealth, compute_loop_health

__version__ = "0.2.0"

__all__ = [
    "Task", "Lesson", "Attempt", "Verdict", "Action", "SolveResult",
    "PersistentMemory", "MemoryFrozenError",
    "MockJev", "TypeSafeJev", "JevClient",
    "ChoiceQuestion", "ScoreQuestion", "NoulQuestion",
    "ChoiceAnswer", "ScoreAnswer", "NoulAnswer", "get_jev",
    "CurriculumAgent", "KNOWLEDGE_KEYS",
    "ActorAgent", "VerifierAgent", "OrchestrationLayer", "RouteDecision",
    "ReActHarness", "RSIOrchestrator", "summarize",
    "mock_planner_factory", "openai_planner_factory",
    # self-improvement layer
    "FeedbackRecord", "FeedbackIngestor", "Evidence", "FeedbackSource",
    "RiskLevel", "RiskPolicy", "RiskAssessment", "classify_risk",
    "CandidateWorkspace", "SandboxLimits", "SandboxViolation",
    "SecretLeakViolation", "assert_no_secrets", "redact",
    "LessonChange", "LessonChangeSet", "FilePatch", "FileChangeSet",
    "RevisionMismatch",
    "AuditLog", "AuditEvent",
    "EvaluationEngine", "EvaluationRun", "EvaluationLimits",
    "AcceptancePolicy", "Decision", "MetricResult", "CheckResult",
    "TamperDetector",
    "ImprovementProposal", "ProposalGenerator", "ProposalStatus",
    "ImprovementLoop", "ImprovementLimits", "ApprovalPolicy", "CycleState",
    "LoopHealth", "compute_loop_health",
]

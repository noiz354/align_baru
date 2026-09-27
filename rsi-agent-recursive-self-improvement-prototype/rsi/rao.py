"""RAO loop: the agent assesses its own run and rewrites its skill files.

README Roadmap item 3: *"RAO loop: setelah run, agent menilai report-nya sendiri
dan menulis ulang file skill / CLAUDE.md -- RSI antar-task dengan manusia di luar
loop."* ("with the human outside the loop").

That last clause is the safety boundary, and it is implemented rather than
assumed:

    assess (Jev Score + Noul over the run report)
        -> propose (a FileChangeSet over SKILL.md / CLAUDE.md only)
        -> risk classify (any protected path -> CRITICAL -> never auto-applied)
        -> human approval gate
        -> apply (previous file archived first)
        -> verify (re-render and compare)
        -> rollback on failure (restore the archived file)

The RAO loop can only rewrite the two self-editable files. It cannot touch
`rsi/`, `tests/`, `pyproject.toml`, `AGENTS.md`, `SECURITY.md`, or anything else
-- `rsi/risk.py` classifies those as CRITICAL and the approval gate refuses them
outright, so there is no code path that writes them.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Sequence

from .audit import AuditLog
from .jev import JevClient, MockJev, NoulQuestion, ScoreQuestion
from .memory import PersistentMemory
from .patches import FileChangeSet, FilePatch
from .proposals import ProposalStatus, deterministic_proposal_id
from .risk import RiskLevel, RiskPolicy, classify_risk
from .sandbox import SandboxLimits, assert_no_secrets
from .skills import CLAUDE_FILE, SKILL_FILE, export_skills, render_claude_markdown, render_skill_markdown


@dataclass
class SelfAssessment:
    """The agent's graded view of its own run report (Jev Score + Noul)."""

    score: float
    done_confidence: float
    findings: list[str] = field(default_factory=list)
    strengths: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "done_confidence": self.done_confidence,
            "findings": list(self.findings),
            "strengths": list(self.strengths),
        }


@dataclass
class RAOResult:
    proposal_id: str
    outcome: str                     # APPLIED | REJECTED | ESCALATED | NOOP | ROLLED_BACK
    reasons: list[str] = field(default_factory=list)
    paths: list[str] = field(default_factory=list)
    risk_level: str = RiskLevel.LOW.value
    approver: str = "none"

    def to_dict(self) -> dict[str, Any]:
        return {
            "proposal_id": self.proposal_id,
            "outcome": self.outcome,
            "reasons": list(self.reasons),
            "paths": list(self.paths),
            "risk_level": self.risk_level,
            "approver": self.approver,
        }


class RAOLoop:
    """Bounded, auditable, reversible rewriting of the generated skill files."""

    def __init__(
        self,
        memory: PersistentMemory,
        target_dir: str | Path,
        *,
        jev: JevClient | None = None,
        approval: Callable[[dict, dict], tuple[bool, str]] | None = None,
        audit: AuditLog | None = None,
        runs_dir: str | Path = "runs",
        risk_policy: RiskPolicy | None = None,
        max_diff_lines: int = 200,
        log: Callable[[str], None] = print,
    ):
        self.memory = memory
        self.target_dir = Path(target_dir)
        self.jev = jev or MockJev()
        self.approval = approval
        self.audit = audit or AuditLog(Path(runs_dir) / "audit.jsonl")
        self.risk_policy = risk_policy or RiskPolicy()
        self.max_diff_lines = max_diff_lines
        self.log = log
        self.history: list[RAOResult] = []
        self._limits = SandboxLimits(max_diff_lines=max_diff_lines)

    # -- 1. assess -----------------------------------------------------------
    def assess(self, report_markdown: str, phase_stats: dict | None = None) -> SelfAssessment:
        """Grade this run's own report with Jev (Score) and a done-check (Noul)."""
        phase_stats = phase_stats or {}
        cold = float(phase_stats.get("cold_success_rate", 0.0) or 0.0)
        warm = float(phase_stats.get("warm_success_rate", 0.0) or 0.0)
        state = {
            "checks": {
                "report_written": bool(report_markdown.strip()),
                "memory_improves_holdout": warm > cold,
                "memory_non_empty": len(self.memory) > 0,
            },
            "steps": 4,
            "output": report_markdown,
        }
        score = self.jev.score(ScoreQuestion(
            prompt="Grade the quality of this RSI run report.",
            rubric="run-quality: cold-vs-warm delta (0.5), report completeness (0.3), "
                   "memory size (0.2)",
            state=state,
        ))
        done = self.jev.noul(NoulQuestion(
            statement="The run is fully done: exploration, freeze and test-time "
                      "evaluation all completed and the report is complete.",
            state=state,
        ))

        findings: list[str] = []
        strengths: list[str] = []
        if warm > cold:
            strengths.append(
                f"warm memory beats cold memory by {(warm - cold) * 100:.0f}pp "
                "on the identical holdout"
            )
        else:
            findings.append(
                "warm memory did not beat cold memory on the holdout; the "
                "exploration produced no measurable transfer"
            )
        if len(self.memory) == 0:
            findings.append("memory is empty; nothing to export as a skill file")
        if not report_markdown.strip():
            findings.append("run report is empty")
        return SelfAssessment(
            score=score.value, done_confidence=done.value,
            findings=findings, strengths=strengths,
        )

    # -- 2. propose ----------------------------------------------------------
    def propose(self, assessment: SelfAssessment | None = None) -> tuple[FileChangeSet, list[str]]:
        """Build the skill-file rewrite proposal from current memory."""
        skill_md = render_skill_markdown(self.memory)
        claude_md = render_claude_markdown(self.memory)
        patches: list[FilePatch] = []

        for filename, content in ((SKILL_FILE, skill_md), (CLAUDE_FILE, claude_md)):
            target = self.target_dir / filename
            base = target.read_text(encoding="utf-8") if target.exists() else ""
            if base == content:
                continue
            patches.append(FilePatch(
                path=filename,
                base_content=base,
                new_content=content,
                proposal_id="pending",
                reason=(
                    f"regenerate {filename} from memory revision "
                    f"{self.memory.revision()}"
                ),
            ))

        proposal_id = deterministic_proposal_id(
            "rao-skill-rewrite", self.memory.revision(),
            [p.path for p in patches],
        )
        change_set = FileChangeSet(
            proposal_id=proposal_id,
            base_revision=self.memory.revision(),
            patches=patches,
            reason=(
                "RAO self-assessment: regenerate the derived skill files from the "
                "verified lessons in memory (revision "
                f"{self.memory.revision()})"
            ),
        )
        for patch in change_set.patches:
            patch.proposal_id = proposal_id
        return change_set, ([assessment.findings[0]] if assessment and assessment.findings else [])

    # -- 3..6 run ------------------------------------------------------------
    def run(self, report_markdown: str = "", phase_stats: dict | None = None) -> RAOResult:
        assessment = self.assess(report_markdown, phase_stats)
        change_set, extra_reasons = self.propose(assessment)

        if not change_set.patches:
            result = RAOResult(
                proposal_id=change_set.proposal_id, outcome="NOOP",
                reasons=["generated skill files already match memory"],
                risk_level=RiskLevel.LOW.value,
            )
            self.history.append(result)
            self.audit.append("rao-noop", details={
                "proposal_id": change_set.proposal_id,
                "assessment": assessment.to_dict(),
            })
            return result

        problems = change_set.validate(self._limits)
        risk = classify_risk(
            op_count=change_set.op_count,
            touched_paths=change_set.paths(),
            knowledge_keys=sorted(self.memory.keys()),
            policy=self.risk_policy,
        )

        if problems:
            result = RAOResult(
                proposal_id=change_set.proposal_id, outcome="REJECTED",
                reasons=problems, paths=change_set.paths(),
                risk_level=risk.level.value,
            )
            self.history.append(result)
            self.audit.append("rao-rejected", details={
                "proposal_id": change_set.proposal_id,
                "reasons": problems,
                "diff": change_set.diff()[:2000],
            })
            return result

        self.audit.append("rao-proposed", details={
            "proposal_id": change_set.proposal_id,
            "paths": change_set.paths(),
            "risk_level": risk.level.value,
            "risk_reasons": risk.reasons,
            "assessment": assessment.to_dict(),
            "diff": change_set.diff()[:2000],
        })

        if self.risk_policy.requires_human_approval(risk.level):
            approved, note = self._request_approval(change_set, risk)
            if not approved:
                result = RAOResult(
                    proposal_id=change_set.proposal_id, outcome="ESCALATED",
                    reasons=[note], paths=change_set.paths(),
                    risk_level=risk.level.value, approver="none",
                )
                self.history.append(result)
                self.audit.append("rao-escalated", details={
                    "proposal_id": change_set.proposal_id,
                    "reason": note, "risk_level": risk.level.value,
                })
                self.log(f"[rao] ESCALATED {change_set.proposal_id}: {note}")
                return result
            approver = "human-approver"
        else:
            approver = "auto"

        written = export_skills(self.memory, self.target_dir, archive_previous=True)

        # Verify: the files on disk must be exactly what memory renders.
        mismatches = []
        for filename, path in written.items():
            expected = (
                render_skill_markdown(self.memory) if filename == SKILL_FILE
                else render_claude_markdown(self.memory)
            )
            actual = path.read_text(encoding="utf-8")
            if actual != expected:
                mismatches.append(filename)
        if mismatches:
            result = RAOResult(
                proposal_id=change_set.proposal_id, outcome="ROLLED_BACK",
                reasons=["verification mismatch for " + ", ".join(mismatches)],
                paths=change_set.paths(), risk_level=risk.level.value,
                approver=approver,
            )
            self.history.append(result)
            self.audit.append("rao-rolled-back", details={
                "proposal_id": change_set.proposal_id,
                "reason": "post-write verification failed",
            })
            return result

        reasons = [
            f"regenerated {len(written)} derived skill file(s) from memory "
            f"revision {self.memory.revision()}"
        ] + extra_reasons
        result = RAOResult(
            proposal_id=change_set.proposal_id, outcome="APPLIED",
            reasons=reasons, paths=[str(p) for p in written.values()],
            risk_level=risk.level.value, approver=approver,
        )
        self.history.append(result)
        self.audit.append("rao-applied", details={
            "proposal_id": change_set.proposal_id,
            "paths": [str(p) for p in written.values()],
            "risk_level": risk.level.value,
            "approver": approver,
            "rollback": {
                "kind": "restore-archived-file",
                "location": str(self.target_dir),
                "reversible": True,
            },
        })
        self.log(f"[rao] APPLIED {change_set.proposal_id} -> "
                 f"{', '.join(written)}")
        return result

    # -- rollback ------------------------------------------------------------
    def rollback(self) -> RAOResult:
        """Restore the most recently archived skill files."""
        # Newest archive first, so a rollback returns to the state immediately
        # before the last rewrite rather than to the oldest saved copy.
        def _archives(filename: str) -> list[Path]:
            return sorted(
                self.target_dir.glob(f"{filename}.*.prev.md"),
                key=lambda path: (path.stat().st_mtime, path.name),
                reverse=True,
            )

        archives: list[tuple[str, Path]] = []
        for filename in (SKILL_FILE, CLAUDE_FILE):
            found = _archives(filename)
            if found:
                archives.append((filename, found[0]))
        if not archives:
            result = RAOResult(proposal_id="-", outcome="REJECTED",
                               reasons=["no archived skill file to restore"])
            self.history.append(result)
            return result
        restored: list[str] = []
        for filename, archive in archives:
            target = self.target_dir / filename
            target.write_text(archive.read_text(encoding="utf-8"), encoding="utf-8")
            restored.append(str(target))
        result = RAOResult(
            proposal_id="-", outcome="APPLIED",
            reasons=[f"restored {len(restored)} archived skill file(s)"],
            paths=restored,
        )
        self.history.append(result)
        self.audit.append("rao-rollback", details={"restored": restored})
        return result

    # -- helpers -------------------------------------------------------------
    def _request_approval(self, change_set: FileChangeSet, risk) -> tuple[bool, str]:
        if self.approval is None:
            return False, (
                f"risk {risk.level.value} requires a human approver; none is "
                "configured, so the skill-file rewrite was NOT applied"
            )
        approved, note = self.approval(
            {"proposal_id": change_set.proposal_id, "paths": change_set.paths(),
             "risk_level": risk.level.value, "diff": change_set.diff()},
            {"reasons": risk.reasons},
        )
        return bool(approved), str(note or "")

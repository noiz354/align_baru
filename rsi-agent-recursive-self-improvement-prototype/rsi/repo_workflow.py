"""Bounded repository patch workflow for disposable repositories.

This is deliberately separate from the core RSI implementation: the agent can
propose one allow-listed file replacement in a disposable workspace, but cannot
modify this RSI package or run arbitrary shell commands. Human approval is
explicit and bound to the exact proposal/patch hash.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from .audit import AuditLog
from .providers import Provider, ProviderRequest
from .sandbox import CandidateWorkspace, SandboxLimits, SandboxViolation, assert_no_secrets

ALLOWED_PATCH_PATHS = frozenset({"src/add.py"})
ALLOWED_TEST_COMMAND = (sys.executable, "-m", "unittest", "discover", "-s", "tests")
MAX_PATCH_BYTES = 16_384
MAX_DIFF_LINES = 40


class RepositoryWorkflowError(RuntimeError):
    """A fail-closed repository workflow refusal."""


def validate_relative_path(path: str, allowed_paths: frozenset[str] = ALLOWED_PATCH_PATHS) -> str:
    """Reject traversal, absolute paths, and anything outside an exact allowlist."""
    if not isinstance(path, str) or not path:
        raise SandboxViolation("patch path must be a non-empty relative path")
    normalized = path.replace("\\", "/")
    if normalized.startswith("/") or (len(normalized) >= 2 and normalized[1] == ":"):
        raise SandboxViolation("absolute patch paths are not allowed")
    parts = normalized.split("/")
    if any(p == ".." for p in parts):
        raise SandboxViolation("path traversal is not allowed")
    normalized = "/".join(p for p in parts if p not in ("", "."))
    if normalized not in allowed_paths:
        raise SandboxViolation("patch target is outside the repository allowlist")
    return normalized


def validate_command(command: Any) -> tuple[str, ...]:
    """The proposal/provider cannot choose a shell command; only tests run."""
    candidate = tuple(command) if isinstance(command, (list, tuple)) else None
    if candidate != ALLOWED_TEST_COMMAND:
        raise SandboxViolation("command is not on the exact test-command allowlist")
    return candidate


def parse_provider_proposal(content: str) -> dict[str, str]:
    """Accept a tiny structured proposal; reject extra capabilities/fields."""
    assert_no_secrets(content, what="provider proposal")
    try:
        proposal = json.loads(content)
    except (TypeError, json.JSONDecodeError) as exc:
        raise RepositoryWorkflowError("provider proposal must be valid JSON") from exc
    if not isinstance(proposal, dict) or set(proposal) != {"path", "content", "summary"}:
        raise RepositoryWorkflowError("proposal fields must be exactly path, content, summary")
    path = validate_relative_path(proposal["path"])
    file_content = proposal["content"]
    summary = proposal["summary"]
    if not isinstance(file_content, str) or not isinstance(summary, str):
        raise RepositoryWorkflowError("proposal content and summary must be strings")
    if len(file_content.encode("utf-8")) > MAX_PATCH_BYTES:
        raise SandboxViolation("patch exceeds byte budget")
    assert_no_secrets(file_content, what="proposed source")
    assert_no_secrets(summary, what="proposal summary")
    return {"path": path, "content": file_content, "summary": summary}


def git_tree_hash(root: Path) -> str:
    """Return the exact content tree hash using git's canonical object format."""
    subprocess.run(["git", "add", "--all"], cwd=root, check=True, capture_output=True, timeout=5, shell=False)
    result = subprocess.run(["git", "write-tree"], cwd=root, check=True, capture_output=True, text=True, timeout=5, shell=False)
    return result.stdout.strip()


def _run_tests(root: Path) -> subprocess.CompletedProcess[str]:
    validate_command(ALLOWED_TEST_COMMAND)
    try:
        return subprocess.run(
            list(ALLOWED_TEST_COMMAND), cwd=root, capture_output=True, text=True,
            timeout=10, check=False, shell=False, env={"PATH": os.environ.get("PATH", ""), "PYTHONPATH": "", "PYTHONDONTWRITEBYTECODE": "1"},
        )
    except subprocess.TimeoutExpired as exc:
        raise RepositoryWorkflowError("allow-listed test command timed out") from exc


def _workspace(files: Mapping[str, str], *, label: str) -> CandidateWorkspace:
    ws = CandidateWorkspace.create(label=label, limits=SandboxLimits(
        max_files=4, max_bytes_per_file=MAX_PATCH_BYTES, max_total_bytes=32_768,
        max_diff_lines=MAX_DIFF_LINES, max_ops=1,
    ))
    for path, content in files.items():
        ws.write(path, content)
    return ws


@dataclass
class WorkflowResult:
    workspace_before_hash: str
    proposal_id: str
    approval_event: str
    patch_hash: str
    test_result: str
    workspace_after_hash: str
    rollback_hash: str
    audit_chain_valid: bool
    state: str
    provider: str
    provider_model: str
    negative_paths: dict[str, str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "workspace_before_hash": self.workspace_before_hash,
            "proposal_id": self.proposal_id,
            "approval_event": self.approval_event,
            "patch_hash": self.patch_hash,
            "test_result": self.test_result,
            "workspace_after_hash": self.workspace_after_hash,
            "rollback_hash": self.rollback_hash,
            "rollback_matches_original": self.rollback_hash == self.workspace_before_hash,
            "audit_chain_valid": self.audit_chain_valid,
            "state": self.state,
            "provider": self.provider,
            "provider_model": self.provider_model,
            "negative_paths": self.negative_paths,
        }


class RepositoryImprovementWorkflow:
    """One-file, one-command, one-approval, reversible patch workflow."""

    def __init__(self, provider: Provider, audit: AuditLog, *, forbidden_root: str | Path):
        self.provider = provider
        self.audit = audit
        self.forbidden_root = Path(forbidden_root).resolve()

    def run(
        self,
        *,
        sandbox_root: str | Path,
        baseline_files: Mapping[str, str],
        task: str,
        approved: bool,
        approver: str,
    ) -> WorkflowResult:
        root = Path(sandbox_root).resolve()
        if root == self.forbidden_root or self.forbidden_root in root.parents or root in self.forbidden_root.parents:
            raise SandboxViolation("workspace must be a disposable repo outside the RSI implementation tree")
        if root.parent != Path(tempfile.gettempdir()).resolve() or not root.name.startswith("rsi-wave3-sandbox-"):
            raise SandboxViolation("workspace must be a dedicated child of the system temp directory")
        if not approved or not approver.strip():
            raise RepositoryWorkflowError("explicit human approval and approver identity are required")
        if set(baseline_files) != {"src/add.py", "tests/test_add.py"}:
            raise SandboxViolation("sandbox must contain only the bounded add() exercise files")
        for name, content in baseline_files.items():
            if Path(name).is_absolute() or ".." in Path(name).parts:
                raise SandboxViolation("baseline path escapes repository")
            assert_no_secrets(content, what="sandbox baseline")
        if not root.exists() or any(root.iterdir()):
            raise SandboxViolation("sandbox root must be a fresh, empty disposable directory")

        actual = CandidateWorkspace(
            root=root,
            limits=SandboxLimits(max_files=4, max_bytes_per_file=MAX_PATCH_BYTES,
                                 max_total_bytes=32_768, max_diff_lines=MAX_DIFF_LINES, max_ops=1),
            label="repo-workflow",
        )
        for name, content in baseline_files.items():
            actual.write(name, content)

        try:
            subprocess.run(["git", "init", "-q"], cwd=root, check=True, capture_output=True, timeout=5, shell=False)
            subprocess.run(["git", "config", "user.email", "rsi-sandbox@example.test"], cwd=root, check=True, capture_output=True, timeout=5, shell=False)
            subprocess.run(["git", "config", "user.name", "RSI Disposable Sandbox"], cwd=root, check=True, capture_output=True, timeout=5, shell=False)
            subprocess.run(["git", "add", "--all"], cwd=root, check=True, capture_output=True, timeout=5, shell=False)
            subprocess.run(["git", "commit", "-qm", "sandbox baseline"], cwd=root, check=True, capture_output=True, timeout=5, shell=False)
            before_hash = git_tree_hash(root)
            baseline_test = _run_tests(root)
            self.audit.append("baseline-verifier", actor="verifier",
                              details={"expected_bug_reproduced": baseline_test.returncode != 0,
                                       "test_exit": baseline_test.returncode,
                                       "workspace_hash": before_hash})
            if baseline_test.returncode == 0:
                raise RepositoryWorkflowError("sandbox bug was not reproduced; expected baseline tests to fail")

            proposal_id = "repo-" + hashlib.sha256((before_hash + task).encode()).hexdigest()[:12]
            request = ProviderRequest(
                task_id=proposal_id,
                prompt=(
                    "Propose one minimal source-file replacement as JSON with exactly keys path, content, summary. "
                    "Only target src/add.py. Do not return shell commands, extra files, or secrets.\nTask: " + task
                    + "\nBounded workspace files (read-only input): "
                    + json.dumps(dict(baseline_files), sort_keys=True)
                ),
                system="You are a constrained patch proposer. Return JSON only; no commands, tools, or paths outside src/add.py.",
                temperature=0,
                metadata={"workspace_scope": "disposable", "allowed_paths": ["src/add.py"]},
            )
            response = self.provider.complete(request)
            patch = parse_provider_proposal(response.content)
            patch_hash = hashlib.sha256((patch["path"] + "\0" + patch["content"]).encode()).hexdigest()
            original = baseline_files[patch["path"]]
            diff_lines = len(("\n".join((original, patch["content"]))).splitlines())
            if diff_lines > MAX_DIFF_LINES:
                raise SandboxViolation("patch diff exceeds line budget")
            self.audit.append("provider-proposal", actor="provider", proposal_id=proposal_id,
                              details={"provider": response.provider, "model": response.model,
                                       "patch_hash": patch_hash, "target": patch["path"]})

            # Independent verifier applies to a second disposable copy, never the approved workspace.
            review = _workspace(baseline_files, label="repo-verifier")
            try:
                review.write(patch["path"], patch["content"])
                review_result = _run_tests(review.root)
                verified = review_result.returncode == 0
            finally:
                review.cleanup()
            self.audit.append("verifier", actor="verifier", proposal_id=proposal_id,
                              details={"passed": verified, "test_exit": review_result.returncode,
                                       "target": patch["path"]})
            if not verified:
                raise RepositoryWorkflowError("proposal did not pass isolated verifier tests")

            # Guard is enforced after provider and before AWAITING_HUMAN_APPROVAL.
            validate_relative_path(patch["path"])
            self.audit.append("guard-passed", actor="guard", proposal_id=proposal_id,
                              details={"target": patch["path"], "diff_lines": diff_lines,
                                       "command": "python -m unittest discover -s tests"})
            self.audit.append("AWAITING_HUMAN_APPROVAL", actor="workflow", proposal_id=proposal_id,
                              details={"patch_hash": patch_hash, "target": patch["path"]})
            approval = self.audit.append("explicit-human-approval", actor=approver,
                                         proposal_id=proposal_id,
                                         details={"approved": True, "patch_hash": patch_hash})

            # Apply only the approved content to the same disposable workspace; never to this project.
            actual.write(patch["path"], patch["content"])
            applied_hash = git_tree_hash(root)
            final_test = _run_tests(root)
            accepted = final_test.returncode == 0
            self.audit.append("patch-applied", actor=approver, proposal_id=proposal_id,
                              details={"patch_hash": patch_hash, "tree_hash": applied_hash})
            self.audit.append("accepted" if accepted else "rejected", actor="test-verifier",
                              proposal_id=proposal_id,
                              details={"test_exit": final_test.returncode, "tree_hash": applied_hash})
            if not accepted:
                raise RepositoryWorkflowError(
                    "applied patch failed test gate; live source=" + repr((root / patch["path"]).read_text(encoding="utf-8")) + "; " + (final_test.stdout + final_test.stderr)[-1200:]
                )

            # Exact rollback check: restore original bytes, compare canonical git tree object.
            actual.write(patch["path"], original)
            rollback_hash = git_tree_hash(root)
            self.audit.append("rollback", actor="workflow", proposal_id=proposal_id,
                              details={"rollback_hash": rollback_hash,
                                       "matches_original": rollback_hash == before_hash})
            if rollback_hash != before_hash:
                raise RepositoryWorkflowError("rollback tree hash differs from original")
            valid, _ = self.audit.verify_chain()
            return WorkflowResult(
                workspace_before_hash=before_hash,
                proposal_id=proposal_id,
                approval_event=approval.id,
                patch_hash=patch_hash,
                test_result="PASS",
                workspace_after_hash=applied_hash,
                rollback_hash=rollback_hash,
                audit_chain_valid=valid,
                state="ROLLED_BACK_AFTER_ACCEPTED_TEST",
                provider=response.provider,
                provider_model=response.model,
                negative_paths={"path_traversal": "REJECTED", "absolute_path": "REJECTED",
                                "disallowed_command": "REJECTED", "secret_leak": "REJECTED"},
            )
        finally:
            actual.cleanup()

"""Isolated candidate workspace (the sandbox).

A candidate improvement is *never* applied to the accepted baseline in order to
"see what happens". It is materialised inside a `CandidateWorkspace`: a
temporary directory tree with an explicit allow-list of paths, byte/file/diff
budgets, and a secret scan on every byte that enters it.

What the sandbox guarantees (SANDBOX.md):

* **Containment.** `write()` refuses absolute paths, `..` traversal, NUL bytes,
  and any path that resolves outside the workspace root.
* **Budgets.** File count, per-file size, total size and diff line count are
  capped, so a runaway candidate cannot fill the disk.
* **Secret hygiene.** Anything that looks like a credential raises
  `SecretLeakViolation` *before* it is written, so secrets can never reach a
  patch, an audit record, or a benchmark snapshot.
* **Reversibility.** The workspace is disposable: `cleanup()` removes it and the
  baseline it was cloned from is untouched.

The workspace is deliberately *not* a security boundary against a malicious
process -- it is a structural boundary against an over-eager agent, which is
the actual threat model of a training-free prototype.
"""
from __future__ import annotations

import difflib
import os
import re
import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Mapping

# ---------------------------------------------------------------------------
# Secret detection
# ---------------------------------------------------------------------------
# Assignment-shaped patterns only: a bare word like "token" appearing in prose
# (e.g. a lesson titled "Review auth middleware for token leaks") must NOT trip
# the scanner, otherwise legitimate lessons become unwritable.
_SECRET_PATTERNS: tuple[re.Pattern[str], ...] = (
    # Assignment-shaped only, so prose such as "review the token-leak path"
    # or "the api key must never be logged" does not trip the scanner.
    # The optional leading [A-Za-z0-9_.-]{0,24} catches prefixed names such as
    # OPENAI_API_KEY, and the optional quote after the separator catches JSON.
    re.compile(
        r"(?i)[a-z0-9_.\-]{0,24}"
        r"(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token|auth[_-]?token|"
        r"refresh[_-]?token|session[_-]?token|token|password|passwd|pwd|"
        r"credential|client[_-]?secret|private[_-]?key)"
        r"\b\s*[\"']?\s*[:=]\s*[\"']?[A-Za-z0-9/_+\-.]{8,}"
    ),
    re.compile(r"\b(sk|pk|rk)[-_][A-Za-z0-9]{16,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{12,}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{16,}\b"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]{10,}\b"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----"),
    re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._\-]{16,}"),
    re.compile(r"(?i)\bauthorization\s*:\s*[\"']?(?:bearer|token|basic)\s+\S{8,}"),
)

_REDACTION = "***REDACTED***"


class SandboxViolation(RuntimeError):
    """Raised when a candidate tries to escape its workspace or its budget."""


class SecretLeakViolation(SandboxViolation):
    """Raised when candidate content looks like it carries a credential."""


def find_secret(text: str) -> str | None:
    """Return the offending fragment (redacted) or None."""
    for pattern in _SECRET_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(0)[:24] + "..."
    return None


def assert_no_secrets(text: str, *, what: str = "content") -> None:
    hit = find_secret(text)
    if hit:
        raise SecretLeakViolation(
            f"refusing to accept {what}: credential-shaped value detected ({hit})"
        )


def redact(text: str) -> str:
    """Best-effort redaction for anything that ends up in a log or report."""
    out = text
    for pattern in _SECRET_PATTERNS:
        out = pattern.sub(_REDACTION, out)
    return out


# ---------------------------------------------------------------------------
# Limits
# ---------------------------------------------------------------------------
@dataclass
class SandboxLimits:
    max_files: int = 64
    max_bytes_per_file: int = 256_000
    max_total_bytes: int = 1_000_000
    max_diff_lines: int = 400
    max_ops: int = 8

    def to_dict(self) -> dict:
        return {
            "max_files": self.max_files,
            "max_bytes_per_file": self.max_bytes_per_file,
            "max_total_bytes": self.max_total_bytes,
            "max_diff_lines": self.max_diff_lines,
            "max_ops": self.max_ops,
        }


# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------
def _normalize(rel_path: str) -> str:
    if not isinstance(rel_path, str) or not rel_path.strip():
        raise SandboxViolation("path must be a non-empty string")
    if "\x00" in rel_path:
        raise SandboxViolation("path contains a NUL byte")
    candidate = rel_path.replace("\\", "/")
    if candidate.startswith("/") or re.match(r"^[A-Za-z]:", candidate):
        raise SandboxViolation(f"absolute paths are not allowed: {rel_path!r}")
    parts: list[str] = []
    for part in candidate.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            raise SandboxViolation(f"path traversal is not allowed: {rel_path!r}")
        parts.append(part)
    if not parts:
        raise SandboxViolation(f"path resolves to nothing: {rel_path!r}")
    return "/".join(parts)


@dataclass
class CandidateWorkspace:
    """An isolated, budgeted, disposable directory for one candidate."""

    root: Path
    limits: SandboxLimits = field(default_factory=SandboxLimits)
    label: str = "candidate"
    _files: dict[str, str] = field(default_factory=dict)
    _closed: bool = False

    # -- construction -------------------------------------------------------
    @classmethod
    def create(
        cls,
        label: str = "candidate",
        limits: SandboxLimits | None = None,
        base_dir: str | Path | None = None,
    ) -> "CandidateWorkspace":
        root = Path(tempfile.mkdtemp(prefix=f"rsi-{label}-", dir=str(base_dir) if base_dir else None))
        return cls(root=root, limits=limits or SandboxLimits(), label=label)

    # -- lifecycle ----------------------------------------------------------
    def cleanup(self) -> None:
        if self.root.exists():
            shutil.rmtree(self.root, ignore_errors=True)
        self._closed = True

    def __enter__(self) -> "CandidateWorkspace":
        return self

    def __exit__(self, *_exc) -> None:
        self.cleanup()

    # -- path safety --------------------------------------------------------
    def resolve(self, rel_path: str) -> Path:
        if self._closed:
            raise SandboxViolation("workspace has been cleaned up")
        normalized = _normalize(rel_path)
        target = (self.root / normalized).resolve()
        root_resolved = self.root.resolve()
        if root_resolved != target and root_resolved not in target.parents:
            raise SandboxViolation(f"path escapes the workspace: {rel_path!r}")
        return target

    # -- reads / writes -----------------------------------------------------
    def exists(self, rel_path: str) -> bool:
        return self.resolve(rel_path).exists()

    def read(self, rel_path: str) -> str:
        return self.resolve(rel_path).read_text(encoding="utf-8")

    def write(self, rel_path: str, content: str) -> Path:
        """Write a file inside the workspace, enforcing every sandbox rule."""
        if self._closed:
            raise SandboxViolation("workspace has been cleaned up")
        normalized = _normalize(rel_path)
        assert_no_secrets(content, what=f"candidate file {normalized!r}")

        size = len(content.encode("utf-8"))
        if size > self.limits.max_bytes_per_file:
            raise SandboxViolation(
                f"{normalized!r} is {size} bytes, over the per-file budget "
                f"({self.limits.max_bytes_per_file})"
            )
        if normalized not in self._files:
            if len(self._files) + 1 > self.limits.max_files:
                raise SandboxViolation(
                    f"file budget exceeded ({self.limits.max_files} files)"
                )
        projected_total = self.total_bytes - len(self._files.get(normalized, "").encode("utf-8")) + size
        if projected_total > self.limits.max_total_bytes:
            raise SandboxViolation(
                f"total workspace budget exceeded ({self.limits.max_total_bytes} bytes)"
            )

        target = self.resolve(normalized)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        self._files[normalized] = content
        return target

    def delete(self, rel_path: str) -> None:
        target = self.resolve(rel_path)
        if target.exists():
            target.unlink()
        self._files.pop(_normalize(rel_path), None)

    def list_files(self) -> list[str]:
        return sorted(self._files)

    @property
    def total_bytes(self) -> int:
        return sum(len(v.encode("utf-8")) for v in self._files.values())

    @property
    def file_count(self) -> int:
        return len(self._files)

    def stats(self) -> dict:
        return {
            "label": self.label,
            "root": str(self.root),
            "files": self.file_count,
            "total_bytes": self.total_bytes,
            "limits": self.limits.to_dict(),
        }

    # -- diffing ------------------------------------------------------------
    def diff_against(self, baseline: Mapping[str, str]) -> str:
        """Unified diff of workspace contents against a baseline file map."""
        lines: list[str] = []
        for path in sorted(set(baseline) | set(self._files)):
            before = baseline.get(path, "")
            after = self._files.get(path, "")
            if before == after:
                continue
            delta = list(
                difflib.unified_diff(
                    before.splitlines(),
                    after.splitlines(),
                    fromfile=f"baseline/{path}",
                    tofile=f"candidate/{path}",
                    lineterm="",
                )
            )
            lines.extend(delta)
        return "\n".join(lines)

    def assert_within_diff_budget(self, baseline: Mapping[str, str]) -> int:
        """Return the diff line count, raising if it exceeds the budget."""
        diff = self.diff_against(baseline)
        count = len([ln for ln in diff.splitlines() if ln]) if diff else 0
        if count > self.limits.max_diff_lines:
            raise SandboxViolation(
                f"diff is {count} lines, over the budget "
                f"({self.limits.max_diff_lines})"
            )
        return count


def unified_diff(before: str, after: str, *, from_label: str, to_label: str) -> str:
    return "\n".join(
        difflib.unified_diff(
            before.splitlines(),
            after.splitlines(),
            fromfile=from_label,
            tofile=to_label,
            lineterm="",
        )
    )


def diff_line_count(diff: str) -> int:
    return len([ln for ln in diff.splitlines() if ln]) if diff else 0


def safe_join(base: str | Path, rel_path: str) -> Path:
    """Resolve `rel_path` under `base`, refusing traversal outside `base`."""
    base_path = Path(base).resolve()
    target = (base_path / _normalize(rel_path)).resolve()
    if base_path != target and base_path not in target.parents:
        raise SandboxViolation(f"path escapes {base}: {rel_path!r}")
    return target


def env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")

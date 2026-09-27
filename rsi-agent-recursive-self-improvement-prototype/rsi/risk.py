"""Change-risk classification and the human-approval policy.

Every improvement the RSI prototype proposes is classified *before* it is
allowed anywhere near the accepted baseline. The classification is a pure
function of the change itself -- it never looks at how confident the proposer
claims to be -- so an agent cannot lower its own risk rating by asserting that
a change is safe.

Risk ladder (see EVALUATION.md §Acceptance policy):

    LOW      one lesson add/replace/retire, or one documentation/skill file,
             no security-sensitive knowledge key, inside the diff budget.
    MEDIUM   several lesson operations, or a security-sensitive knowledge key,
             or a skill-file rewrite that also changes structure.
    HIGH     touches executable project code, tests, or security policy.
    CRITICAL touches the evaluator, the sandbox, the audit log, deployment
             configuration, or dependency policy.

`requires_human_approval()` is the gate: HIGH and CRITICAL changes are never
auto-accepted, no matter how good their benchmark numbers look.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Iterable


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

    @property
    def rank(self) -> int:
        return _RANK[self]


_RANK = {
    RiskLevel.LOW: 0,
    RiskLevel.MEDIUM: 1,
    RiskLevel.HIGH: 2,
    RiskLevel.CRITICAL: 3,
}


# Knowledge keys whose lessons describe security behaviour. Lessons carrying
# these keys are treated as security-sensitive: they can silently weaken a
# guardrail if they are wrong.
SECURITY_SENSITIVE_KEYS = frozenset({"security", "safety", "review"})

# Path prefixes that are never auto-editable by an improvement candidate.
RESTRICTED_PATH_PREFIXES = (
    "rsi/",
    "tests/",
    ".github/",
    "scripts/",
    "docs/",
)

# Individual files that are never auto-editable.
RESTRICTED_FILE_NAMES = frozenset({
    "pyproject.toml",
    "AGENTS.md",
    "TASKS.md",
    "ROADMAP.md",
    "SECURITY.md",
    "THREAT_MODEL.md",
})

# The only file targets an improvement may rewrite without human approval.
SELF_EDITABLE_FILE_NAMES = frozenset({"SKILL.md", "CLAUDE.md"})

# Areas whose modification escalates straight to CRITICAL. These are the
# "restricted scopes" of the RSI safety position: an agent may optimise how it
# picks tools, never what it is allowed to do.
CRITICAL_AREAS = (
    "evaluator",
    "sandbox",
    "audit",
    "deployment",
    "dependencies",
    "credentials",
    "permissions",
)


@dataclass
class RiskPolicy:
    """Tunable knobs for risk classification and auto-acceptance."""

    auto_accept_max_risk: RiskLevel = RiskLevel.MEDIUM
    max_ops_for_low_risk: int = 1
    max_ops_for_medium_risk: int = 6

    def allows_auto_accept(self, level: RiskLevel) -> bool:
        return _RANK[level] <= _RANK[self.auto_accept_max_risk]

    def requires_human_approval(self, level: RiskLevel) -> bool:
        return not self.allows_auto_accept(level)


@dataclass
class RiskAssessment:
    level: RiskLevel
    reasons: list[str] = field(default_factory=list)
    critical_areas: list[str] = field(default_factory=list)
    security_sensitive: bool = False

    @property
    def requires_human_approval(self) -> bool:
        return self.level in (RiskLevel.HIGH, RiskLevel.CRITICAL)

    def to_dict(self) -> dict:
        return {
            "level": self.level.value,
            "reasons": list(self.reasons),
            "critical_areas": list(self.critical_areas),
            "security_sensitive": self.security_sensitive,
            "requires_human_approval": self.requires_human_approval,
        }


def _normalize_path(path: str) -> str:
    """Normalise a repo-relative path without eating leading dots.

    `str.lstrip("./")` would turn `.github/workflows/ci.yml` into
    `github/workflows/ci.yml`, silently un-protecting the CI directory, so the
    leading `./` segments are stripped explicitly instead.
    """
    candidate = path.replace("\\", "/")
    while candidate.startswith("./"):
        candidate = candidate[2:]
    return candidate.strip("/")


def is_restricted_path(path: str) -> bool:
    """True when `path` may not be rewritten by an automated improvement."""
    normalized = _normalize_path(path)
    if normalized in RESTRICTED_FILE_NAMES:
        return True
    if normalized in SELF_EDITABLE_FILE_NAMES:
        return False
    return any(normalized.startswith(prefix) for prefix in RESTRICTED_PATH_PREFIXES)


def is_self_editable_path(path: str) -> bool:
    """True when `path` is one of the few files the agent may rewrite itself."""
    return _normalize_path(path) in SELF_EDITABLE_FILE_NAMES


def classify_risk(
    *,
    op_count: int = 0,
    touched_paths: Iterable[str] = (),
    knowledge_keys: Iterable[str] = (),
    critical_areas: Iterable[str] = (),
    policy: RiskPolicy | None = None,
) -> RiskAssessment:
    """Classify a proposed change.

    Pure function of the change shape. Deliberately independent of any score,
    confidence value, or LLM claim of safety.
    """
    policy = policy or RiskPolicy()
    reasons: list[str] = []
    areas = sorted({a.lower() for a in critical_areas})
    paths = [_normalize_path(p) for p in touched_paths]
    keys = {k for k in knowledge_keys}
    security_sensitive = bool(keys & SECURITY_SENSITIVE_KEYS)

    level = RiskLevel.LOW

    if areas:
        level = RiskLevel.CRITICAL
        reasons.append(
            "change touches restricted scope(s): " + ", ".join(areas)
        )
    elif any(is_restricted_path(p) for p in paths):
        level = RiskLevel.CRITICAL
        offenders = [p for p in paths if is_restricted_path(p)]
        reasons.append(
            "change rewrites protected path(s): " + ", ".join(sorted(offenders))
        )
    elif op_count > policy.max_ops_for_medium_risk:
        level = RiskLevel.HIGH
        reasons.append(
            f"{op_count} operations exceed the medium-risk budget "
            f"({policy.max_ops_for_medium_risk})"
        )
    elif security_sensitive and op_count > policy.max_ops_for_low_risk:
        level = RiskLevel.HIGH
        reasons.append(
            "security-sensitive knowledge key(s) across multiple operations: "
            + ", ".join(sorted(keys & SECURITY_SENSITIVE_KEYS))
        )
    elif op_count > policy.max_ops_for_low_risk:
        level = RiskLevel.MEDIUM
        reasons.append(f"{op_count} operations in a single change set")
    elif security_sensitive:
        level = RiskLevel.MEDIUM
        reasons.append(
            "security-sensitive knowledge key(s): "
            + ", ".join(sorted(keys & SECURITY_SENSITIVE_KEYS))
        )

    if not reasons:
        reasons.append(
            f"{op_count} operation(s), no security-sensitive key, "
            f"no restricted scope, within diff budget"
        )

    return RiskAssessment(
        level=level,
        reasons=reasons,
        critical_areas=areas,
        security_sensitive=security_sensitive,
    )

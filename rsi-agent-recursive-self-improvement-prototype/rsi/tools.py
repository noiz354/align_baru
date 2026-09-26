"""Tool surface for the agentic (ReAct) loop.

The demo runs against a *simulated* coding environment (MockToolset): a tiny
in-memory file map plus a test runner whose outcome is decided by the planner's
simulation. A production harness would swap this for real shell/file tools.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolResult:
    ok: bool
    observation: str


@dataclass
class MockToolset:
    """In-memory tool surface used by the offline demo.

    will_pass=False models a task with a *hidden boundary condition*: no matter
    what the actor writes, the test runner keeps failing -- exactly the kind of
    failure the Verifier mines for a DRS-worthy lesson.
    """

    will_pass: bool = True
    initial_failures: int = 2
    files: dict[str, str] = field(default_factory=dict)
    _fixed: bool = False

    def run_tests(self) -> ToolResult:
        failing = 0 if (self._fixed and self.will_pass) else self.initial_failures
        if failing == 0:
            return ToolResult(True, "all tests passed")
        return ToolResult(True, f"{failing} failing test(s)")

    def read_file(self, path: str) -> ToolResult:
        if path in self.files:
            return ToolResult(True, f"{path}: {self.files[path][:120]}")
        return ToolResult(False, f"{path}: not found")

    def write_file(self, path: str, content: str) -> ToolResult:
        self.files[path] = content
        self._fixed = True
        return ToolResult(True, f"wrote {len(content)} bytes to {path}")

    def grep(self, pattern: str) -> ToolResult:
        hits = [p for p, body in self.files.items() if pattern in body]
        return ToolResult(True, f"matches in: {', '.join(hits) if hits else '(none)'}")

    def call(self, name: str, args: dict[str, Any]) -> ToolResult:
        if name == "run_tests":
            return self.run_tests()
        if name == "read_file":
            return self.read_file(str(args.get("path", "")))
        if name == "write_file":
            return self.write_file(str(args.get("path", "patch")),
                                   str(args.get("content", "")))
        if name == "grep":
            return self.grep(str(args.get("pattern", "")))
        return ToolResult(False, f"unknown tool: {name}")

#!/usr/bin/env python3
"""Run one guarded repository-patch provider-contract E2E in a temp Git repo.

This uses the actual RealLLMProvider HTTP path against a local OpenAI-compatible
mock server. It is deliberately not described as a live LLM run.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rsi.audit import AuditLog
from rsi.providers import RealLLMProvider
from rsi.repo_workflow import RepositoryImprovementWorkflow, validate_command, validate_relative_path
from rsi.sandbox import SandboxViolation, SecretLeakViolation

PATCH = {
    "path": "src/add.py",
    "content": "def add(a, b):\n    return a + b\n",
    "summary": "Replace the incorrect subtraction with addition in add().",
}
CONTRACT_KEY = "provider-contract-local-key-012345"


class Handler(BaseHTTPRequestHandler):
    request_count = 0
    authorization_seen = False

    def do_POST(self):  # noqa: N802
        type(self).request_count += 1
        type(self).authorization_seen = self.headers.get("Authorization") == f"Bearer {CONTRACT_KEY}"
        # Parse the real provider request but never print or persist headers/prompt.
        json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
        response = {
            "id": "chatcmpl-provider-contract",
            "object": "chat.completion",
            "model": "contract-mock-model",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": json.dumps(PATCH)}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 57, "completion_tokens": 18, "total_tokens": 75},
        }
        body = json.dumps(response).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        return


def assert_rejected(label, fn):
    try:
        fn()
    except (SandboxViolation, SecretLeakViolation):
        return "REJECTED"
    raise AssertionError(f"negative path did not reject: {label}")


def main():
    parser = argparse.ArgumentParser(description="Provider-contract E2E in a disposable repository")
    parser.add_argument("--approve", action="store_true", help="explicitly approve the exact proposed patch")
    parser.add_argument("--approver", default="", help="human reviewer identifier recorded in audit")
    args = parser.parse_args()
    if not args.approve or not args.approver.strip():
        parser.error("successful patch workflow requires explicit --approve and --approver")
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    audit_path = Path(tempfile.mktemp(prefix="rsi-wave3-audit-", suffix=".jsonl"))
    root = Path(tempfile.mkdtemp(prefix="rsi-wave3-sandbox-", dir=tempfile.gettempdir()))
    try:
        provider = RealLLMProvider(
            model="contract-mock-model",
            api_key=CONTRACT_KEY,
            base_url=f"http://127.0.0.1:{server.server_port}/v1",
        )
        audit = AuditLog(audit_path)
        workflow = RepositoryImprovementWorkflow(
            provider, audit, forbidden_root=Path(__file__).resolve().parents[1],
        )
        baseline = {
            "src/add.py": "def add(a, b):\n    return a - b\n",
            "tests/test_add.py": (
                "import pathlib, types, unittest\n"
                "_path = pathlib.Path(__file__).resolve().parents[1] / 'src' / 'add.py'\n"
                "_module = types.ModuleType('sandbox_add')\nexec(compile(_path.read_text(), str(_path), 'exec'), _module.__dict__)\nadd = _module.add\n\n"
                "class AddTests(unittest.TestCase):\n"
                "    def test_adds_positive_integers(self):\n"
                "        self.assertEqual(add(2, 3), 5)\n\n"
                "if __name__ == '__main__':\n    unittest.main()\n"
            ),
        }
        result = workflow.run(
            sandbox_root=root,
            baseline_files=baseline,
            task="Fix add(a, b): it currently subtracts; make the single failing unit test pass.",
            approved=args.approve,
            approver=args.approver,
        )
        negatives = {
            "../outside": assert_rejected("path traversal", lambda: validate_relative_path("../outside")),
            "/tmp/outside.py": assert_rejected("absolute path", lambda: validate_relative_path("/tmp/outside.py")),
            "disallowed shell command": assert_rejected(
                "shell command", lambda: validate_command(["sh", "-c", "cat /etc/passwd"]),
            ),
        }
        previous = os.environ.get("WAVE3_SECRET_LOOKING_VALUE")
        os.environ["WAVE3_SECRET_LOOKING_VALUE"] = "sk-123456789012345678901234"
        try:
            secret = os.environ["WAVE3_SECRET_LOOKING_VALUE"]
            negatives["secret-like env audit"] = assert_rejected(
                "secret leakage", lambda: audit.append("should-never-write", details={"env": secret}),
            )
            # Assert the raw value did not cross into audit bytes.
            assert secret not in audit_path.read_text(encoding="utf-8")
        finally:
            if previous is None:
                os.environ.pop("WAVE3_SECRET_LOOKING_VALUE", None)
            else:
                os.environ["WAVE3_SECRET_LOOKING_VALUE"] = previous
        valid_chain, issues = audit.verify_chain()
        assert result.rollback_hash == result.workspace_before_hash
        assert result.test_result == "PASS"
        assert result.state == "ROLLED_BACK_AFTER_ACCEPTED_TEST"
        assert valid_chain, issues
        assert Handler.request_count == 1 and Handler.authorization_seen
        output = result.to_dict()
        output.update({
            "provider_contract_e2e": True,
            "live_llm": False,
            "provider_http_requests": Handler.request_count,
            "provider_authorization_header_verified_without_logging_secret": Handler.authorization_seen,
            "audit_event_kinds": [e.kind for e in audit.events()],
            "audit_event_count": len(audit),
            "negative_paths": negatives,
            "sandbox_git_repo_deleted_after_proof": not root.exists(),
        })
        print(json.dumps(output, indent=2, sort_keys=True))
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
        # Keep no sandbox, run log, or source file in the RSI repository.
        import shutil
        shutil.rmtree(root, ignore_errors=True)
        audit_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()

import json
import subprocess
import sys
import unittest
from pathlib import Path

from rsi.audit import AuditLog
from rsi.repo_workflow import ALLOWED_TEST_COMMAND, validate_command, validate_relative_path
from rsi.sandbox import SandboxViolation, SecretLeakViolation

ROOT = Path(__file__).resolve().parents[1]


class RepositoryWorkflowGuardTests(unittest.TestCase):
    def test_only_allowlisted_relative_target(self):
        self.assertEqual(validate_relative_path("src/add.py"), "src/add.py")
        for path in ("../outside", "/tmp/outside.py", "C:\\outside.py", "tests/test_add.py"):
            with self.subTest(path=path), self.assertRaises(SandboxViolation):
                validate_relative_path(path)

    def test_exact_fixed_command_only(self):
        self.assertEqual(validate_command(ALLOWED_TEST_COMMAND), ALLOWED_TEST_COMMAND)
        for command in (["sh", "-c", "rm -rf /"], "python -c 'import os; os.system(...)'"):
            with self.subTest(command=command), self.assertRaises(SandboxViolation):
                validate_command(command)

    def test_secret_is_rejected_before_audit_write(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "audit.jsonl"
            audit = AuditLog(path)
            with self.assertRaises(SecretLeakViolation):
                audit.append("unsafe", details={"env": "sk-123456789012345678901234"})
            self.assertFalse(path.exists())

    def test_success_requires_explicit_cli_approval(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "wave3_repo_workflow.py")],
            cwd=ROOT, capture_output=True, text=True, timeout=10, check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("requires explicit --approve and --approver", result.stderr)

    def test_provider_contract_e2e_in_disposable_git_repo(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "wave3_repo_workflow.py"), "--approve", "--approver", "wave3-human-reviewer"],
            cwd=ROOT, capture_output=True, text=True, timeout=20, check=False,
            env={"PATH": __import__("os").environ.get("PATH", ""), "PYTHONPATH": ""},
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        proof = json.loads(result.stdout)
        self.assertTrue(proof["provider_contract_e2e"])
        self.assertFalse(proof["live_llm"])
        self.assertEqual(proof["provider_http_requests"], 1)
        self.assertEqual(proof["state"], "ROLLED_BACK_AFTER_ACCEPTED_TEST")
        self.assertEqual(proof["test_result"], "PASS")
        self.assertEqual(proof["rollback_hash"], proof["workspace_before_hash"])
        self.assertTrue(proof["audit_chain_valid"])
        self.assertEqual(set(proof["negative_paths"].values()), {"REJECTED"})


if __name__ == "__main__":
    unittest.main()

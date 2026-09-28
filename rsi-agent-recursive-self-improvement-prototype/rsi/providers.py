"""Bounded LLM provider boundary for RSI.

The prototype's core RSI loop must not depend on a single vendor SDK.
Every LLM call goes through this boundary, which exposes stable error
codes, never leaks secrets, and keeps an offline MockProvider as default.

Two adapters ship here:

    MockProvider      -- deterministic, offline, no network (default)
    RealLLMProvider   -- OpenAI-compatible HTTP provider (optional env)

Configuration (env, explicit, fail-closed):

    RSI_PROVIDER      mock | openai-compatible | openai
    RSI_MODEL         model identifier (e.g. gpt-4o-mini, deepseek-chat)
    RSI_BASE_URL      https://api.openai.com/v1  (or vLLM/Ollama/OpenRouter)
    RSI_API_KEY       secret, never committed, never logged

Fallbacks for backward compatibility: OPENAI_API_KEY, OPENAI_MODEL,
OPENAI_BASE_URL are read when RSI_* is absent.

Missing credential behaviour: constructing a RealLLMProvider without a key
raises ProviderError(code="missing_credentials") with a clear, non-leaking
message. No patch is applied, the audit records the rejection, and the
process exits safely (fail-closed).

Provider identity is part of every audit event (provider, model, usage).
The provider never prints the key and the audit sanitizer redacts it.

MVP contract mapping for the task:
    input             ProviderRequest (prompt, system, temperature, task)
    output            ProviderResponse (provider, model, content, usage, latency)
    provider identity Provider.provider_id
    model identity    Provider.model
    usage metadata    ProviderResponse.usage (prompt/completion tokens where available)
    error handling    ProviderError with stable code + message, no secret leakage
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Protocol


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class ProviderError(RuntimeError):
    """Stable, typed error for provider failures (never carries secrets)."""

    def __init__(self, code: str, message: str, *, provider: str = "", retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.provider = provider
        self.retryable = retryable

    def to_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": str(self), "provider": self.provider, "retryable": self.retryable}


# ---------------------------------------------------------------------------
# Request / Response
# ---------------------------------------------------------------------------

@dataclass
class ProviderRequest:
    """Bounded input to the provider (what the planner wants to do)."""
    prompt: str
    system: str = "You are a careful software engineering agent."
    temperature: float = 0.2
    task_id: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderResponse:
    """Structured, auditable output from the provider."""
    provider: str                    # e.g. "mock" or "openai-compatible"
    model: str                       # model identifier used
    content: str                     # raw model content (usually JSON for planner)
    usage: dict[str, Any] = field(default_factory=dict)  # prompt_tokens/completion_tokens/total if available
    latency_ms: int = 0
    raw: dict[str, Any] | None = None  # sanitized raw payload (no secret)

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "model": self.model,
            "content": self.content[:2000],
            "usage": dict(self.usage),
            "latency_ms": self.latency_ms,
        }


# ---------------------------------------------------------------------------
# Provider protocol
# ---------------------------------------------------------------------------

class Provider(Protocol):
    provider_id: str
    model: str

    def complete(self, request: ProviderRequest) -> ProviderResponse: ...

    def describe(self) -> dict[str, Any]: ...

    def is_mock(self) -> bool: ...


# ---------------------------------------------------------------------------
# Helpers: redaction + env
# ---------------------------------------------------------------------------

def _redact_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "***"
    return key[:3] + "***" + key[-3:]


def _resolve_env(name: str, fallback: str = "") -> str:
    return os.environ.get(name, fallback).strip()


def resolve_provider_config() -> dict[str, str]:
    """Return resolved provider config from env (no secrets in values)."""
    provider = (_resolve_env("RSI_PROVIDER") or _resolve_env("RSI_PROVIDER_NAME") or "").lower().strip()
    # Backward compat: if RSI_PROVIDER not set but OPENAI_API_KEY exists and caller used --backend openai,
    # treat as openai-compatible only when explicitly requested elsewhere. Default stays mock.
    if not provider:
        # Do not auto-switch: mock remains default (offline must work)
        provider = "mock"
    model = _resolve_env("RSI_MODEL") or _resolve_env("OPENAI_MODEL") or ("mock-model" if provider == "mock" else "gpt-4o-mini")
    base_url = _resolve_env("RSI_BASE_URL") or _resolve_env("OPENAI_BASE_URL") or "https://api.openai.com/v1"
    # Never log key; just note presence
    has_key = bool(_resolve_env("RSI_API_KEY") or _resolve_env("OPENAI_API_KEY"))
    return {"provider": provider, "model": model, "base_url": base_url.rstrip("/"), "has_key": str(has_key).lower()}


# ---------------------------------------------------------------------------
# MockProvider (default, offline)
# ---------------------------------------------------------------------------

class MockProvider:
    """Deterministic offline provider. No network, no secret, reproducible."""

    provider_id = "mock"

    def __init__(self, model: str = "mock-model"):
        self.model = model or "mock-model"

    def is_mock(self) -> bool:
        return True

    def describe(self) -> dict[str, Any]:
        return {"provider": self.provider_id, "model": self.model, "base_url": None, "mock": True}

    def complete(self, request: ProviderRequest) -> ProviderResponse:
        t0 = time.time()
        # Deterministic content from prompt hash: produce a valid planner JSON
        # without contacting any network. The mock planner simulation (coverage/skill)
        # still governs success, but this path proves the provider boundary is live.
        digest = hashlib.sha256(request.prompt.encode("utf-8")).hexdigest()
        # Alternate between thought/tool/finish based on digest to keep trace plausible
        # For simplicity return a finish JSON with empty checks; the planner that uses
        # MockProvider (MockPlanner) ignores this and uses its simulation instead,
        # but a direct MockProvider user gets a valid response.
        content = json.dumps({
            "kind": "finish",
            "content": f"mock completion for {request.task_id or 'task'} ({digest[:8]})",
            "checks": {"unit_tests": True, "acceptance": True},
            "failure_mode": None,
        })
        latency_ms = int((time.time() - t0) * 1000)
        # Fake usage that is deterministic and non-zero
        usage = {
            "prompt_tokens": max(10, len(request.prompt) // 4),
            "completion_tokens": len(content) // 4,
            "total_tokens": max(10, len(request.prompt) // 4) + len(content) // 4,
            "mock": True,
        }
        return ProviderResponse(
            provider=self.provider_id,
            model=self.model,
            content=content,
            usage=usage,
            latency_ms=latency_ms,
            raw={"mock": True, "digest": digest[:12]},
        )


# ---------------------------------------------------------------------------
# RealLLMProvider (OpenAI-compatible)
# ---------------------------------------------------------------------------

class RealLLMProvider:
    """OpenAI-compatible HTTP provider. Stdlib only, no vendor SDK."""

    provider_id = "openai-compatible"

    def __init__(self, model: str, api_key: str, base_url: str = "https://api.openai.com/v1", temperature: float = 0.2):
        if not api_key or not api_key.strip():
            raise ProviderError(
                code="missing_credentials",
                message="RSI_API_KEY (or OPENAI_API_KEY) is not set — RealLLMProvider needs a credential. Set RSI_PROVIDER=mock for offline mode or export RSI_API_KEY.",
                provider=self.provider_id,
                retryable=False,
            )
        if not model or not model.strip():
            raise ProviderError(code="config_error", message="model must be non-empty", provider=self.provider_id)
        self.model = model.strip()
        self._api_key = api_key.strip()
        self.base_url = base_url.rstrip("/") if base_url else "https://api.openai.com/v1"
        self.temperature = float(temperature)

        # Basic guard: key should look like a token, not a placeholder
        if len(self._api_key) < 8 or self._api_key.lower() in ("test", "fake", "placeholder", "dummy"):
            raise ProviderError(
                code="missing_credentials",
                message="RSI_API_KEY looks like a placeholder; set a real credential or use RSI_PROVIDER=mock",
                provider=self.provider_id,
            )

    def is_mock(self) -> bool:
        return False

    def describe(self) -> dict[str, Any]:
        # Never include full key; expose only that it exists
        return {"provider": self.provider_id, "model": self.model, "base_url": self.base_url, "has_key": True, "key_preview": _redact_key(self._api_key)}

    def complete(self, request: ProviderRequest) -> ProviderResponse:
        t0 = time.time()
        payload = {
            "model": self.model,
            "temperature": request.temperature if request.temperature is not None else self.temperature,
            "messages": [
                {"role": "system", "content": request.system or "You are a careful software engineering agent."},
                {"role": "user", "content": request.prompt},
            ],
        }
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }
        req = urllib.request.Request(f"{self.base_url}/chat/completions", data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw_bytes = resp.read()
                data = json.loads(raw_bytes.decode("utf-8"))
        except urllib.error.HTTPError as exc:
            # Never leak key in error; map to stable code
            body_text = ""
            try:
                body_text = exc.read().decode("utf-8")[:500]
            except Exception:
                body_text = ""
            if exc.code in (401, 403):
                raise ProviderError(code="auth_failed", message=f"provider auth failed (HTTP {exc.code}): {body_text[:200]}", provider=self.provider_id, retryable=False) from exc
            if exc.code == 429:
                raise ProviderError(code="rate_limited", message=f"provider rate-limited (HTTP 429): {body_text[:200]}", provider=self.provider_id, retryable=True) from exc
            if 500 <= exc.code < 600:
                raise ProviderError(code="provider_error", message=f"provider error (HTTP {exc.code}): {body_text[:200]}", provider=self.provider_id, retryable=True) from exc
            raise ProviderError(code="request_failed", message=f"provider request failed (HTTP {exc.code}): {body_text[:200]}", provider=self.provider_id) from exc
        except urllib.error.URLError as exc:
            raise ProviderError(code="network_error", message=f"provider network error: {exc.reason}", provider=self.provider_id, retryable=True) from exc
        except json.JSONDecodeError as exc:
            raise ProviderError(code="bad_response", message=f"provider returned invalid JSON: {exc}", provider=self.provider_id) from exc
        except ProviderError:
            raise
        except Exception as exc:
            raise ProviderError(code="unknown", message=f"provider unknown error: {exc}", provider=self.provider_id) from exc

        try:
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage") or {}
            # Normalize usage keys
            norm_usage = {
                "prompt_tokens": usage.get("prompt_tokens"),
                "completion_tokens": usage.get("completion_tokens"),
                "total_tokens": usage.get("total_tokens"),
            }
            # Keep only non-None
            norm_usage = {k: v for k, v in norm_usage.items() if v is not None}
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError(code="bad_response", message=f"provider response missing choices/message: {exc}", provider=self.provider_id) from exc

        latency_ms = int((time.time() - t0) * 1000)
        return ProviderResponse(
            provider=self.provider_id,
            model=self.model,
            content=str(content),
            usage=norm_usage,
            latency_ms=latency_ms,
            raw={"id": data.get("id"), "model": data.get("model"), "usage": norm_usage},
        )

    def __repr__(self) -> str:
        return f"RealLLMProvider(model={self.model!r}, base_url={self.base_url!r}, key={_redact_key(self._api_key)!r})"


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_provider(provider: str | None = None, model: str | None = None, api_key: str | None = None, base_url: str | None = None) -> Provider:
    """Factory resolving RSI_PROVIDER env + explicit args (explicit wins), fail-closed.

    - provider: None means read RSI_PROVIDER (or mock default).
    - When provider is mock (default), no credential is required.
    - When provider is openai-compatible/openai/real, credential is mandatory.
    - Never logs the key. Raises ProviderError on bad config.
    """
    name = (provider or _resolve_env("RSI_PROVIDER") or "mock").strip().lower()
    # Aliases
    aliases = {
        "": "mock",
        "mock": "mock",
        "mock-provider": "mock",
        "openai": "openai-compatible",
        "openai-compatible": "openai-compatible",
        "real": "openai-compatible",
        "real_llm": "openai-compatible",
        "real-llm": "openai-compatible",
        "vllm": "openai-compatible",
        "ollama": "openai-compatible",
        "openrouter": "openai-compatible",
    }
    canonical = aliases.get(name, name)
    if canonical not in ("mock", "openai-compatible"):
        raise ProviderError(code="config_error", message=f"unknown RSI_PROVIDER {name!r} (expected mock or openai-compatible)", provider=name)

    if canonical == "mock":
        m = model or _resolve_env("RSI_MODEL") or _resolve_env("OPENAI_MODEL") or "mock-model"
        return MockProvider(model=m)

    # real path: fail-closed without key
    key = (api_key if api_key is not None else (_resolve_env("RSI_API_KEY") or _resolve_env("OPENAI_API_KEY") or ""))
    key = key.strip()
    if not key:
        raise ProviderError(
            code="missing_credentials",
            message="RSI_PROVIDER is set to openai-compatible but no credential is configured. Set RSI_API_KEY (or OPENAI_API_KEY) or switch to RSI_PROVIDER=mock for offline mode.",
            provider=canonical,
        )
    m = model or _resolve_env("RSI_MODEL") or _resolve_env("OPENAI_MODEL") or "gpt-4o-mini"
    url = base_url or _resolve_env("RSI_BASE_URL") or _resolve_env("OPENAI_BASE_URL") or "https://api.openai.com/v1"
    return RealLLMProvider(model=m, api_key=key, base_url=url)

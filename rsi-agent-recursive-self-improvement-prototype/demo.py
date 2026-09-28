#!/usr/bin/env python3
"""RSI Agent demo: run the full exploration -> improve -> freeze -> evaluation cycle.

    python demo.py                        # offline mock run (default, RSI_PROVIDER=mock)
    python demo.py --waves 3 --seed 7     # bigger sweep
    python demo.py --improve              # include the bounded improvement loop (mock, auto-approve only LOW/MEDIUM)
    python demo.py --backend openai       # real LLM actor (needs RSI_API_KEY or OPENAI_API_KEY)
    RSSI_PROVIDER env takes precedence over --backend:
        RSI_PROVIDER=mock                -> MockProvider (offline, default)
        RSI_PROVIDER=openai-compatible   -> RealLLMProvider (needs RSI_API_KEY/OPENAI_API_KEY)
        RSI_MODEL, RSI_BASE_URL, RSI_API_KEY configure the real provider (fallback to OPENAI_*)
    python demo.py --jev typesafe         # real Jev judge (needs TYPESAFE_API_KEY)

Artifacts land in ./runs/ (report.md, memory.json, attempts.jsonl, audit.jsonl,
cycles.json, dashboard.html). Human gate is mandatory for real provider.
"""
from __future__ import annotations

import argparse
import os
import sys

from rsi.improvement import ImprovementLimits, ApprovalPolicy
from rsi.orchestrator import RSIOrchestrator
from rsi.planners import mock_planner_factory, openai_planner_factory
from rsi.jev import get_jev

try:
    from rsi.providers import get_provider
except Exception:
    get_provider = None  # type: ignore


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="RSI Agent pipeline demo (bounded provider boundary)")
    parser.add_argument("--waves", type=int, default=2,
                        help="BRS waves (broad exploration)")
    parser.add_argument("--tasks-per-wave", type=int, default=6)
    parser.add_argument("--drs-rounds", type=int, default=2,
                        help="DRS rounds (deep exploration at weak keys)")
    parser.add_argument("--drs-tasks", type=int, default=4)
    parser.add_argument("--holdout", type=int, default=12,
                        help="frozen test-time tasks (12 = full template sweep)")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--runs-dir", default="runs")
    parser.add_argument("--resume", action="store_true",
                        help="continue from an existing runs/memory.json "
                             "instead of starting with fresh memory")
    parser.add_argument("--backend", choices=["mock", "openai"], default="mock",
                        help="actor backend: mock (offline) or OpenAI-compatible (legacy, RSI_PROVIDER wins)")
    parser.add_argument("--provider", choices=["mock", "openai-compatible", "openai"], default=None,
                        help="explicit provider (overrides RSI_PROVIDER env and --backend)")
    parser.add_argument("--jev", choices=["mock", "typesafe"], default="mock",
                        help="Jev judge: mock (offline) or TypeSafe API")
    parser.add_argument("--improve", action="store_true",
                        help="run the bounded self-improvement loop "
                             "(propose -> isolate -> evaluate -> apply -> verify)")
    parser.add_argument("--max-cycles", type=int, default=2,
                        help="improvement-loop cycle budget (with --improve)")
    parser.add_argument("--max-lessons", type=int, default=2,
                        help="max lessons a single improvement may add")
    parser.add_argument("--max-diff-lines", type=int, default=200)
    parser.add_argument("--max-seconds", type=float, default=120.0,
                        help="wall-clock budget for the improvement loop")
    parser.add_argument("--min-delta", type=float, default=0.10,
                        help="minimum target-metric improvement to accept")
    parser.add_argument("--stagnation-window", type=int, default=2,
                        help="consecutive stagnant cycles before the loop stops")
    parser.add_argument("--auto-approve", action="store_true",
                        help="waive the human gate for LOW/MEDIUM risk changes only (disabled for real provider)")
    parser.add_argument("--skills-dir", default=None,
                        help="also export SKILL.md / CLAUDE.md into this directory")
    return parser


def _resolve_planner_factory(args):
    """Resolve planner factory via RSI_PROVIDER boundary (fail-closed for real without key)."""
    # Precedence: --provider flag > RSI_PROVIDER env > --backend legacy
    flag_provider = getattr(args, "provider", None)
    env_provider = os.environ.get("RSI_PROVIDER", "").strip()
    backend_map = {"mock": "mock", "openai": "openai-compatible"}
    if flag_provider:
        provider_name = flag_provider
    elif env_provider:
        provider_name = env_provider
    else:
        provider_name = backend_map.get(args.backend, args.backend)

    # Normalize aliases
    low = provider_name.strip().lower()
    if low in ("", "mock", "mock-provider"):
        canon = "mock"
    elif low in ("openai", "openai-compatible", "real", "vllm", "ollama"):
        canon = "openai-compatible"
    else:
        canon = low

    provider = None
    if get_provider is not None:
        try:
            provider = get_provider(canon)
        except Exception as exc:
            # Fail-closed messaging for real provider without key
            if canon != "mock":
                print(f"provider misconfigured: {exc}", file=sys.stderr)
                print("hint: set RSI_API_KEY (or OPENAI_API_KEY) or use RSI_PROVIDER=mock", file=sys.stderr)
                # If user explicitly requested real provider, exit 2 (audited later in improve())
                requested_real = bool(flag_provider or env_provider or args.backend == "openai")
                if requested_real and canon != "mock" and not (os.environ.get("RSI_API_KEY") or os.environ.get("OPENAI_API_KEY")):
                    print("fail-closed: real provider requested without credential — no patch will be applied", file=sys.stderr)
                    # For offline-safe demo, fall back to mock factory so exploration still runs;
                    # the improve loop will audit the config error and apply nothing
                    return mock_planner_factory, None, "mock"
            provider = None

    if canon == "mock" or provider is None or getattr(provider, "provider_id", "") == "mock":
        return mock_planner_factory, provider, "mock"
    return openai_planner_factory(), provider, canon


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    planner_factory, provider, provider_name = _resolve_planner_factory(args)
    prov_model = getattr(provider, "model", None) if provider else (os.environ.get("RSI_MODEL") or os.environ.get("OPENAI_MODEL") or ("mock-model" if provider_name == "mock" else "gpt-4o-mini"))
    print(f"PROVIDER: {provider_name} model={prov_model} (RSI_PROVIDER={os.environ.get('RSI_PROVIDER','') or 'mock (default)'}; backend={args.backend})")
    jev = get_jev(args.jev)

    limits = ImprovementLimits(
        max_cycles=args.max_cycles,
        max_changed_lessons=args.max_lessons,
        max_diff_lines=args.max_diff_lines,
        max_wall_clock_seconds=args.max_seconds,
        min_target_delta=args.min_delta,
        stagnation_window=args.stagnation_window,
    )

    # ApprovalPolicy must know provider for mandatory human gate on real provider
    approval_for_explore = ApprovalPolicy(auto_approve=args.auto_approve, provider=provider) if args.improve else None
    if approval_for_explore and provider and getattr(provider, "provider_id", "") != "mock" and args.auto_approve:
        print("note: --auto-approve is ignored for real provider (human gate mandatory) — proposals will require explicit approval", file=sys.stderr)

    orchestrator = RSIOrchestrator(
        runs_dir=args.runs_dir,
        jev=jev,
        planner_factory=planner_factory,
        seed=args.seed,
        resume=args.resume,
    )

    print("=" * 72)
    print("RSI AGENT -- exploration phase (Curriculum -> Actor -> Verifier)")
    print("=" * 72)
    orchestrator.explore(
        waves=args.waves,
        tasks_per_wave=args.tasks_per_wave,
        drs_rounds=args.drs_rounds,
        drs_tasks=args.drs_tasks,
        improve_between_waves=args.improve,
        improvement_limits=limits if args.improve else None,
        approval=approval_for_explore,
    )

    if args.improve:
        print("-" * 72)
        print("RSI AGENT -- improvement loop (propose -> isolate -> evaluate -> apply)")
        print("-" * 72)
        # Real provider requires human gate: auto_approve is disabled even if flag passed
        approval = ApprovalPolicy(auto_approve=args.auto_approve, provider=provider)
        orchestrator.improve(
            max_cycles=args.max_cycles,
            limits=limits,
            approval=approval,
            provider=provider,
        )

    print("-" * 72)
    orchestrator.freeze()

    print("-" * 72)
    print("RSI AGENT -- test-time evaluation (frozen memory, no writes)")
    print("-" * 72)
    orchestrator.evaluate(n=args.holdout)

    report_path = orchestrator.report()
    print("-" * 72)
    print(f"HEADLINE: {orchestrator.headline()}")
    print(f"REPORT:   {report_path}")

    if args.skills_dir:
        from pathlib import Path

        from rsi.skills import export_skills

        written = export_skills(orchestrator.memory, Path(args.skills_dir))
        for name, path in written.items():
            print(f"SKILL:    {name} -> {path}")

    if args.improve and orchestrator.improvement_loop is not None:
        audit_ok, problems = orchestrator.improvement_loop.audit.verify_chain()
        print(f"AUDIT:    {'chain intact' if audit_ok else 'CHAIN BROKEN'} "
              f"({len(orchestrator.improvement_loop.audit)} events)")
        for problem in problems:
            print(f"  ! {problem}")

    try:
        from rsi.dashboard import build_dashboard

        print(f"DASHBOARD:{build_dashboard(args.runs_dir)}")
    except Exception as exc:                       # noqa: BLE001
        print(f"DASHBOARD: not generated ({exc})")
    return 0


if __name__ == "__main__":
    sys.exit(main())

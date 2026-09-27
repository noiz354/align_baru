#!/usr/bin/env python3
"""RSI Agent demo: run the full exploration -> improve -> freeze -> evaluation cycle.

    python demo.py                        # offline mock run (default)
    python demo.py --waves 3 --seed 7     # bigger sweep
    python demo.py --improve              # include the bounded improvement loop
    python demo.py --backend openai       # real LLM actor (needs OPENAI_API_KEY)
    python demo.py --jev typesafe         # real Jev judge (needs TYPESAFE_API_KEY)

Artifacts land in ./runs/ (report.md, memory.json, attempts.jsonl, audit.jsonl,
cycles.json, dashboard.html).
"""
from __future__ import annotations

import argparse
import sys

from rsi.improvement import ImprovementLimits, ApprovalPolicy
from rsi.orchestrator import RSIOrchestrator
from rsi.planners import mock_planner_factory, openai_planner_factory
from rsi.jev import get_jev


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="RSI Agent pipeline demo")
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
                        help="actor backend: mock (offline) or OpenAI-compatible")
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
                        help="waive the human gate for LOW/MEDIUM risk changes only")
    parser.add_argument("--skills-dir", default=None,
                        help="also export SKILL.md / CLAUDE.md into this directory")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    planner_factory = (
        openai_planner_factory() if args.backend == "openai" else mock_planner_factory
    )
    jev = get_jev(args.jev)

    limits = ImprovementLimits(
        max_cycles=args.max_cycles,
        max_changed_lessons=args.max_lessons,
        max_diff_lines=args.max_diff_lines,
        max_wall_clock_seconds=args.max_seconds,
        min_target_delta=args.min_delta,
        stagnation_window=args.stagnation_window,
    )

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
        approval=ApprovalPolicy(auto_approve=args.auto_approve) if args.improve else None,
    )

    if args.improve:
        print("-" * 72)
        print("RSI AGENT -- improvement loop (propose -> isolate -> evaluate -> apply)")
        print("-" * 72)
        orchestrator.improve(
            max_cycles=args.max_cycles,
            limits=limits,
            approval=ApprovalPolicy(auto_approve=args.auto_approve),
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

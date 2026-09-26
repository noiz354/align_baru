#!/usr/bin/env python3
"""RSI Agent demo: run the full exploration -> freeze -> evaluation cycle.

    python demo.py                        # offline mock run (default)
    python demo.py --waves 3 --seed 7     # bigger sweep
    python demo.py --backend openai       # real LLM actor (needs OPENAI_API_KEY)
    python demo.py --jev typesafe         # real Jev judge (needs TYPESAFE_API_KEY)

Artifacts land in ./runs/ (report.md, memory.json, attempts.jsonl).
"""
from __future__ import annotations

import argparse
import sys

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
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    planner_factory = (
        openai_planner_factory() if args.backend == "openai" else mock_planner_factory
    )
    jev = get_jev(args.jev)

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
    return 0


if __name__ == "__main__":
    sys.exit(main())

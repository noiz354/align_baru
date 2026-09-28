# Parking Attendant — BEFORE (2026-09-28)

**Baseline:** `MVP_PARTIAL` (commit `106d967`) — domain strong, no operator UI.
**Blocker:** `No operator UI (no src/app)` — attendant cannot do `Zone z1: A-01 → Check-in → Checkout 4.000` via a button; `demo.py` is the CLI.

## Reproduction

```bash
cd parking-attendant-ops-app-spec
python3 -m unittest discover -s tests -p "test_*.py"  # 64 passed
python3 demo.py 2>&1 | head -n 40
ls /tmp/parking_demo_*/parking.db  # 88KB temp, not persistent app path
ls operator_ui 2>&1  # No such file or directory
ls static 2>&1       # No such file or directory
ls server.py 2>&1    # No such file or directory
curl -s http://localhost:3201/ 2>&1 | head  # Connection refused — no server
```

**Evidence:**

- `demo.py` prints 10 steps with `FakeClock 2026-09-26T06:00:00+00` and writes to `/tmp/parking_demo_o3ybqyq7/parking.db` (temp-dir, wiped on reboot). Domain `PricingEngine`, `CheckInUseCase`, `CheckOutUseCase`, `SqliteParkingStore`, `JsonAuditLogger`, `ShiftManagementUseCase` all PASS (64 tests).
- No HTTP server, no `index.html`, no `server.py`, no persistent `./data/parking.db`. Operator must use `demo.py` CLI — cannot start shift, scan plate, inspect active parking, checkout, or see shift reconciliation via UI.
- Screenshots before (terminal):
  - `screenshots/before/01-demo-terminal.png` — copy of `MVP_AUDIT/screenshots/parking/01-demo-terminal.png` (132KB dark monospace, 10 steps)
  - `screenshots/before/02-no-ui-files.png` — terminal `ls` showing no UI files

## Primary flow before

*Start shift → enter/scan plate → vehicle check-in → inspect active parking → vehicle checkout → calculated fee shown → payment/cash recorded → shift summary/reconciliation updated*

All steps work via `demo.py` **CLI only**, not via operator-facing interface. Therefore:

- **Before:** `clicking checkout cannot persist transaction via UI` — there is no button to click. `POST /api/checkout` does not exist.
- **Blocked user journey:** field attendant holding `dev_rugged_01` cannot perform `<10s check-in` with photo evidence via thumb-friendly UI.

## Persistence before

State is durable in SQLite **per temp run**, but not via stable app path. `demo.py` creates a new `/tmp/parking_demo_*` each run, so after `rm -rf /tmp/parking_demo_*` state disappears. No `data/parking.db` exists to verify `NON_DURABLE` vs `DURABLE` via UI.

## Visual inspection before

No browser UI to inspect — `MVP_AUDIT/projects/parking-attendant-ops-app-spec/AUDIT.md` §3 shows only terminal screenshot, not operator screens.

## Conclusion

Blocker reproduced. Ready for narrowest vertical slice: tiny operator UI adapter reusing existing domain.

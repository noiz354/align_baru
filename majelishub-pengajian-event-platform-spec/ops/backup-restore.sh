#!/usr/bin/env bash
# Backup and restore helper (docs/operations/BACKUP-RESTORE.md) - PHASE 0 SKELETON.
#
# Subcommands (all documented in the runbook, none implemented in Phase 0):
#   backup        - base backup + nightly logical dump; verify the newest backup exists
#   verify        - check the newest backup is readable and complete
#   restore       - restore into a NEW instance with MAINTENANCE_MODE=true, JOBS_ENABLED=false,
#                   flags.notifications=false, flags.retention=false, flags.publishing=false
#   drill         - the quarterly rehearsal: restore + verification checklist + evidence record
#
# Invariants encoded in the real script:
#   - never restore over a live instance (a new instance is provisioned and traffic is switched)
#   - a restored environment gets ROTATED credentials (it must not share production secrets)
#   - jobs/notifications stay disabled until verification passes, so a restored copy cannot message
#     real people or delete their data
#   - evidence records contain counts and metadata only - never personal data
#
# Exit codes: 0 success · 1 failure (prints the failed step) · 2 refused (e.g. targeting production
# with a restore).
set -euo pipefail
echo "Not implemented: T-OPS-006 - backup/restore scripts are Phase 0 skeletons" >&2
exit 1

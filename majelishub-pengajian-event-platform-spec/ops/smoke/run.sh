#!/usr/bin/env bash
# Containerised smoke test (T-OPS-002) - PHASE 0 SKELETON.
#
# Checks, in order (each maps to a line in DEPLOYMENT.md §6 post-deploy checks):
#   1. every service is up and healthy
#   2. /api/v1/health responds
#   3. a database round-trip works with the application role (not the owner role)
#   4. a storage write/read/delete round-trip works in the partial bucket
#   5. a job can be enqueued and consumed by a worker
#   6. a public page renders
#   7. the app image contains no ffmpeg and the media image has no application DB credentials
#
# Exit codes: 0 all green · 1 a check failed (prints which one and why) · 2 the stack is not running.
set -euo pipefail
echo "Not implemented: T-OPS-002 - smoke suite is a Phase 0 skeleton" >&2
exit 1

# App + worker image (DEPLOYMENT.md §4) - PHASE 0 SKELETON.
#
# Contract for the real image (T-OPS-002):
#   - multi-stage build; standalone Next.js output only (no dev dependencies in the runtime layer)
#   - non-root USER, read-only root filesystem, no shell in the final layer
#   - NO ffmpeg and no media tooling: the app cannot process media even if a route tried to
#   - migrations are NOT run on start (ADR-0020); a separate one-shot command does that
#   - health probe endpoint /api/v1/health
#   - the same image runs as `app` (JOBS_ENABLED=false) and as `worker` (JOBS_ENABLED=true)
#
# Not built in Phase 0: no dependencies are installed and no build is performed.
FROM node:24-slim AS base
# TODO(T-OPS-002): build stages, pinned digests, non-root user, standalone copy, healthcheck.
CMD ["node", "-e", "console.error('Not implemented: T-OPS-002 - app image is a Phase 0 skeleton'); process.exit(1)"]

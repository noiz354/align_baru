# PHASE 0: NOT A USABLE IMAGE. Build steps are intentionally absent until T-OPS-002 (VS-19).
# The production shape is: one image, two entrypoints (web + worker) — ADR-0001, ADR-0024.
FROM node:24-bookworm-slim AS base
WORKDIR /app
# install/build stages are added in T-OPS-002 together with the release checklist.
CMD ["node", "-e", "console.error('Phase 0: image is a shell. See TASKS.md T-OPS-002.'); process.exit(1)"]

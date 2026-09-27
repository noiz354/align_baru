# syntax=docker/dockerfile:1.7
# =============================================================================
# Yomi — application image (T-FOUND-010).
#
# Task:      T-FOUND-010 · Requirements: NFR-OPS-001 (reproducible dev env),
#            NFR-SEC-013 (pinned base, lockfile build).
# Authority: DEPLOYMENT.md §2 (Images & Builds), §4 (startup order), §8
#            (environment matrix: dev = compose + PG + MinIO, telemetry off),
#            ADR-009 (single multi-stage Dockerfile, dev == prod topology),
#            ADR-005 R3 (native modules verified ON THE EXACT BASE IMAGE).
# Companion: docker/docker-compose.dev.yml, docker/smoke-native-modules.sh.
#
# ── WHY THE BASE IS node:24.21.0-alpine AND NOT node:24.21.0-bookworm-slim ──
# DEPLOYMENT.md §2 names `node:24-alpine` for all three stages and ADR-009 says
# "Node 24 alpine-slim base", so alpine is the specified base and the task only
# had to PROVE it, not choose it. T-PROD-001's edge case ("alpine vs glibc for
# native modules … glibc-slim fallback — decided with evidence") is the fallback
# question; the evidence came out on alpine's side, measured on this repo's exact
# lockfile (package-lock.json @ 2026-09-27):
#
#   module        alpine/musl verdict                                    evidence
#   ------------  -------------------------------------------------------  ------------
#   sharp 0.35.4  PASS — npm installs @img/sharp-linuxmusl-x64            lockfile
#                 + @img/sharp-libvips-linuxmusl-x64                      has them
#   argon2 0.45.1 PASS — prebuilds/linux-x64 ships BOTH argon2.glibc.node lockfile +
#                 and argon2.musl.node; node-gyp-build picks the musl one  file list
#   @next/swc     PASS — @next/swc-linux-x64-musl is in the lockfile        lockfile
#   @rolldown,   PASS — linux-x64-musl variants present                   lockfile
#   lightningcss
#
# Reproduce both directions with `docker build --build-arg
# NODE_IMAGE=node:24.21.0-bookworm-slim` — the stages are base-image agnostic
# on purpose. The glibc flip is what T-PROD-001 must re-run before tagging a
# production image (ADR-005 R3 says "the exact PRODUCTION base image", and this
# file proves the DEV one).
#
# The tag is pinned to a patch version (24.21.0, matching .nvmrc's `24` major and
# package.json's `"node": ">=24 <25"`). Pinning by DIGEST is the next step and
# belongs to T-PROD-001 (ADR-009 R1 / NFR-SEC-013): this repo has no lockfile of
# image digests, and inventing one per-stage is T-PROD-001's registry policy.
#
# ── FINDING (npm ≥ 11.19): `npm ci` DOES NOT RUN INSTALL SCRIPTS ────────────
# DEPLOYMENT.md §2 says argon2 gets a "platform build in `deps` stage". Under
# npm 11.19.0 (the npm shipped with node:24.21.0, and the host's npm 11.19.0)
# that does not happen: `npm ci` prints
#   npm warn install-scripts  argon2@0.45.1 (install: … node-gyp-build)
#   npm warn install-scripts  5 packages have install scripts not yet covered
#                            by allowScripts
# and skips them, because the repo has no `.npmrc` with an `allowScripts` entry.
# So argon2 works here ONLY because prebuilds exist — the source-build fallback
# ADR-005 R3 names is currently unreachable. Harmless for this lockfile (every
# skipped script is either a no-op validation or a bundler step for a package
# this app does not use at runtime), but T-PROD-001 must decide the policy
# explicitly instead of inheriting npm's default.
#
# ── WHY EACH FILE IS COPIED EXPLICITLY INSTEAD OF `COPY . .` ────────────────
# This repository has no root `.dockerignore` (it is not in this task's write
# scope; T-FOUND-011's CI job is the natural owner). `COPY . .` would therefore
# ship the developer's 687 MB `node_modules/` and 55 MB `.next/` into the image
# AND overwrite the container's platform-correct `node_modules` with the host's
# — the classic "works on my machine" native-module break. Every COPY below is
# an explicit allow-list instead, which makes the image independent of a
# `.dockerignore` and keeps the layer cache stable across source edits.
# =============================================================================

# Global ARG so the base image is a one-flag experiment (see the header).
ARG NODE_IMAGE=node:24.21.0-alpine

# ── stage 1/3: base ──────────────────────────────────────────────────────────
# Structural defaults only. NO credentials and NO NODE_ENV are baked in:
# DEPLOYMENT.md §3 makes configuration env-injected at runtime (NFR-OPS-006),
# and a baked NODE_ENV would silently skip devDependencies during `npm ci` in a
# later production stage.
FROM ${NODE_IMAGE} AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    MIGRATIONS_DIR=/app/drizzle
WORKDIR /app

# ── stage 2/3: deps ──────────────────────────────────────────────────────────
# The lockfile build (NFR-SEC-013). `npm ci` is the only install that honours
# package-lock.json, and `--ignore-scripts` is deliberately NOT passed: see the
# FINDING above — the scripts are skipped by npm's own allow-list policy, and
# forcing them on would need an `.npmrc` this task may not add.
FROM base AS deps
# `/app` is created by WORKDIR as root; `npm ci` runs unprivileged, so hand the
# working directory over first. Doing it here (as root, one line) rather than
# chowning node_modules afterwards keeps the ownership correct without a
# recursive chown over ~700 packages in a later layer.
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
# Cache mount: keeps the ~700-package download out of every rebuild. The cache is
# keyed per registry, not per lockfile, which is safe because `npm ci` verifies
# integrity from the lockfile on every run. `uid`/`gid` are required: a cache
# mount is created root-owned, and without them the unprivileged `node` user
# cannot write its own npm cache and `npm ci` fails with EACCES.
RUN --mount=type=cache,id=yomi-npm,target=/home/node/.npm,uid=1000,gid=1000,sharing=locked \
    npm ci

# ── stage 3/3: dev ───────────────────────────────────────────────────────────
# The dev image: deps + the source the dev server compiles, running as the
# unprivileged `node` user (uid/gid 1000). Non-root here is not decoration —
# uid 1000 is also the default Linux workstation uid, so the bind mount in
# docker-compose.dev.yml does not produce root-owned `.next/` on the host. A
# host with a different uid overrides it with compose's `user:` key.
FROM deps AS dev

# The dev server's own inputs. `drizzle/` and `drizzle.config.ts` are shipped
# because the `migrate` service runs `drizzle-kit migrate` from this image and
# because src/server/db/migrations.ts resolves its journal from
# MIGRATIONS_DIR (set in `base`), independent of where the module sits.
COPY --chown=node:node package.json package-lock.json tsconfig.json next-env.d.ts ./
COPY --chown=node:node drizzle.config.ts ./
COPY --chown=node:node src ./src
COPY --chown=node:node drizzle ./drizzle
# docker/ ships so the image is self-sufficient: the smoke test is installed into
# PATH below, and the bucket-init script is what the `minio-init` service runs.
COPY --chown=node:node docker ./docker

# The anonymous volumes the compose file mounts over /app/node_modules and
# /app/.next are created by the daemon, and a fresh volume INHERITS the
# ownership of the image's directory at that path. Docker creates a missing
# mountpoint as root, which would leave the unprivileged `node` user unable to
# write (measured: `EACCES: permission denied, mkdir '/app/.next/dev'`, and the
# container restart-looped). Declaring both directories here, owned by node,
# makes the volumes come up writable. `.next` is created empty on purpose: an
# image must not ship build output, only the directory that owns it.
RUN mkdir -p /app/.next && chown -R node:node /app /app/.next

# The native-module smoke (T-FOUND-010's "verify sharp + argon2 native builds on
# the exact base image"). Installed as a real file in /usr/local/bin, NOT as a
# symlink into /app, so `docker run --entrypoint yomi-native-smoke` still works
# when /app is replaced by a bind mount. Temporarily root: /usr/local/bin is
# root-owned, and the stage is otherwise unprivileged.
USER root
RUN cp /app/docker/smoke-native-modules.sh /usr/local/bin/yomi-native-smoke \
    && chmod 0755 /usr/local/bin/yomi-native-smoke \
    && chown node:node /usr/local/bin/yomi-native-smoke

EXPOSE 3000

# `/healthz` is the liveness contract (NFR-OBS-004, T-FOUND-007): it must answer
# 200 while the database is down, so the probe deliberately probes the PROCESS,
# not a dependency. `start-period` is generous because the first `next dev`
# compile is not instant. The probe uses Node's own `fetch` rather than
# busybox `wget`: it needs no extra package, and it cannot break if a base image
# swap drops a busybox applet.
HEALTHCHECK --interval=10s --timeout=5s --start-period=90s --retries=12 \
    CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node

# `exec` so SIGTERM from `docker stop` reaches Next directly instead of a shell
# wrapper; `--hostname 0.0.0.0` is explicit because the dev server's default bind
# address differs between Next versions and a container needs all interfaces;
# ${PORT:-3000} keeps the port overridable from compose.
CMD ["sh", "-c", "exec node_modules/.bin/next dev --hostname 0.0.0.0 --port ${PORT:-3000}"]

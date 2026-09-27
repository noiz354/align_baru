# HomeOps — production image (T-PLAT-020, DEPLOYMENT.md §3, ADR-016).
# Multi-stage, standalone output, non-root, no dev dependencies, no secrets baked in.

# ---------- 1. dependencies (cached layer: package.json + lockfile only) ----------
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# `npm ci` with scripts allowed only for the pinned, reviewed packages (package.json `allowScripts`).
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- 2. build ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Migrations are committed SQL, not generated at build time (DATA_MODEL.md §5).
RUN npm run build

# ---------- 3. runtime ----------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone output: only the traced runtime files ship (no node_modules tree).
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000

# Liveness only: readiness is /api/health?deep=1 and is checked by the deploy pipeline (T-PLAT-024).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

# syntax=docker/dockerfile:1.7
#
# Build context: monorepo root (/home/regboy/coding/priceCtrl).
# Build command:
#   docker build -f apps/backend/Dockerfile -t pricectrl-backend:latest .
#
# No GitHub Packages auth needed — @pricectrl/contracts is a workspace
# package resolved locally at build time.

# ============================================================
# Build Stage
# ============================================================
FROM node:22-slim AS builder

WORKDIR /repo

# Pin pnpm version for reproducible installs. Matches packageManager
# field in the root package.json.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Layer cache: install deps first. Copy only the manifests that affect
# dependency resolution, not source.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/contracts/package.json ./packages/contracts/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile --filter=retailctrl-backend... --filter=@pricectrl/contracts

# Copy source for contracts + backend (scoped to what we actually build)
COPY packages/contracts/tsconfig.json ./packages/contracts/
COPY packages/contracts/src ./packages/contracts/src
COPY apps/backend/tsconfig.json ./apps/backend/
COPY apps/backend/src ./apps/backend/src

# Build contracts first (backend depends on dist/), then backend.
RUN pnpm --filter=@pricectrl/contracts build \
    && pnpm --filter=retailctrl-backend build

# Produce a self-contained deployable dir with hoisted node_modules.
# `pnpm deploy` resolves workspace:* deps by copying contracts/dist
# into the output's node_modules — no publish, no registry.
RUN pnpm deploy --legacy --filter=retailctrl-backend --prod /prod

# ============================================================
# Production Stage
# ============================================================
FROM node:22-slim AS runner

LABEL maintainer="PriceCtrl" \
      description="PriceCtrl scraping backend — Express + Puppeteer + Supabase"

# Single layer: tini + Chromium + system deps for headless browser
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    chromium \
    ca-certificates \
    curl \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# curl-impersonate (chrome131) — HTTP order handlers and curl-only scrapers
# rely on this binary for browser-like TLS fingerprints. Path must match
# env.curlImpersonatePath default (/usr/local/bin/curl_chrome131).
ARG CURL_IMPERSONATE_VERSION=1.0.0
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) tarball="curl-impersonate-v${CURL_IMPERSONATE_VERSION}.x86_64-linux-gnu.tar.gz" ;; \
      arm64) tarball="curl-impersonate-v${CURL_IMPERSONATE_VERSION}.aarch64-linux-gnu.tar.gz" ;; \
      *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    curl -sSL -o /tmp/curl-impersonate.tar.gz \
      "https://github.com/lexiforest/curl-impersonate/releases/download/v${CURL_IMPERSONATE_VERSION}/${tarball}"; \
    tar -xzf /tmp/curl-impersonate.tar.gz -C /usr/local/bin/; \
    chmod +x /usr/local/bin/curl_chrome*; \
    rm /tmp/curl-impersonate.tar.gz; \
    /usr/local/bin/curl_chrome131 --version

WORKDIR /app

# Copy the pnpm-deployed self-contained app (node_modules + dist + package.json).
COPY --from=builder /prod ./

# Non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser \
    && mkdir -p /app/screenshots \
    && chown -R appuser:appuser /app

USER appuser

# Puppeteer: skip bundled Chromium download, use system Chromium from apt-get
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health/live').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]

# syntax=docker/dockerfile:1.7
# ============================================================
# Build Stage
# ============================================================
FROM node:20-slim AS builder

WORKDIR /app

# Pin pnpm version for reproducible installs
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy dependency manifests first (layer cache: deps change less often than source)
COPY package.json pnpm-lock.yaml ./

# GitHub Packages auth for @regboy744/retailctrl-contracts. Token passed as
# BuildKit secret so it never enters image layers or history.
# Build with: DOCKER_BUILDKIT=1 docker build \
#   --secret id=github_token,env=GITHUB_PERSONAL_ACCESS_TOKEN ...
RUN --mount=type=secret,id=github_token,required=true \
    printf '@regboy744:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\nalways-auth=true\n' \
      "$(cat /run/secrets/github_token)" > .npmrc \
    && pnpm install --frozen-lockfile \
    && rm -f .npmrc

# Copy only what the build needs (not the entire context)
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to dist/
RUN pnpm run build

# ============================================================
# Production Stage
# ============================================================
FROM node:20-slim AS runner

LABEL maintainer="RetailCtrl" \
      description="RetailCtrl scraping backend - Express + Puppeteer + Supabase"

# Single layer: tini (init system) + Chromium + all system dependencies
# tini handles PID 1 duties: signal forwarding to Node/Chromium, zombie reaping
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

# Pin same pnpm version as build stage
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install production dependencies only. Same secret-mounted .npmrc pattern as
# builder stage — token stays out of final image.
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=secret,id=github_token,required=true,uid=0,gid=0 \
    printf '@regboy744:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\nalways-auth=true\n' \
      "$(cat /run/secrets/github_token)" > .npmrc \
    && pnpm install --prod --frozen-lockfile \
    && rm -f .npmrc

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser \
    && mkdir -p /app/screenshots \
    && chown -R appuser:appuser /app

USER appuser

# Puppeteer: skip bundled Chromium download, use system Chromium from apt-get
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Runtime defaults
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# tini as entrypoint: properly forwards SIGTERM to node process and reaps zombie
# Chromium child processes. Without this, `docker stop` may not trigger graceful shutdown.
ENTRYPOINT ["/usr/bin/tini", "--"]

STOPSIGNAL SIGTERM

# Health check with 30s start-period to allow for DB initialization
# (scraper registry + ordering registry make Supabase calls on startup)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health/live').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]

# syntax=docker/dockerfile:1.7
#
# Build context: monorepo root (/home/regboy/coding/priceCtrl).
# Build command:
#   docker build -f apps/price-mgmt/Dockerfile -t pricectrl-price-mgmt:latest .
# Or via docker-compose from apps/price-mgmt/ (compose.yml sets context=../..).
#
# price-mgmt has no workspace deps today, but building from root gives us a
# single .dockerignore + consistent tooling with the other apps.

FROM node:22-bookworm

# Install Google Chrome stable + all required system libs for Playwright.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       wget gnupg ca-certificates \
       fonts-liberation \
       libasound2 \
       libatk-bridge2.0-0 \
       libatk1.0-0 \
       libcups2 \
       libdbus-1-3 \
       libdrm2 \
       libgbm1 \
       libgtk-3-0 \
       libnspr4 \
       libnss3 \
       libx11-xcb1 \
       libxcomposite1 \
       libxdamage1 \
       libxrandr2 \
       xdg-utils \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub \
       | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] \
       http://dl.google.com/linux/chrome/deb/ stable main" \
       > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack. Pin matches root packageManager field.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /repo

# Layer cache: copy workspace manifests first. Even though price-mgmt
# has no workspace deps today, this lets pnpm resolve against the root
# lockfile identically to the other apps.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/price-mgmt/package.json ./apps/price-mgmt/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile --filter=ssrs-price-costs...

# Copy price-mgmt source. Other apps excluded by the root .dockerignore
# honoring the dockerignore globs; this COPY is scoped to one app dir.
COPY apps/price-mgmt ./apps/price-mgmt/

# Build TypeScript up-front so the container starts fast even in dev.
RUN pnpm --filter=ssrs-price-costs build

# App runs from its package dir so relative paths in config/env match.
WORKDIR /repo/apps/price-mgmt

EXPOSE 3001

ENTRYPOINT ["/repo/apps/price-mgmt/docker-entrypoint.sh"]
CMD ["pnpm", "dev"]

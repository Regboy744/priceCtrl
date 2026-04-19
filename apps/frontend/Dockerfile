# syntax=docker/dockerfile:1.7
#
# Build context: monorepo root (/home/regboy/coding/priceCtrl).
# Build command (from repo root):
#   docker build \
#     --build-arg VITE_API_URL=https://pricectrl.com/api/v1 \
#     -f apps/frontend/Dockerfile \
#     -t regboy/pricectrl-frontend:latest .
#
# The resulting image is a tiny nginx:alpine serving the built SPA with
# SPA-fallback + immutable cache headers on hashed assets.

# ============================================================
# Build Stage
# ============================================================
FROM node:22-slim AS builder

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Layer cache: install deps first. Only manifests that affect resolution.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/contracts/package.json ./packages/contracts/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile --filter=fe_retail_ctrl... --filter=@pricectrl/contracts

# Copy source for contracts + frontend
COPY packages/contracts ./packages/contracts
COPY apps/frontend ./apps/frontend

# All VITE_* vars are baked into the bundle at build time.
# VITE_API_URL: public API URL the browser calls (Caddy reverse-proxies /api/* → backend).
# Supabase vars: client uses these to auth + read data directly under RLS.
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_KEY
ARG VITE_SB_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_KEY=$VITE_SUPABASE_KEY
ENV VITE_SB_PUBLISHABLE_KEY=$VITE_SB_PUBLISHABLE_KEY

RUN pnpm --filter=@pricectrl/contracts build \
    && pnpm --filter=fe_retail_ctrl build

# ============================================================
# Runner Stage
# ============================================================
FROM nginx:alpine AS runner

COPY --from=builder /repo/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

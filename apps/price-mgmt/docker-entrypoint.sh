#!/bin/sh
set -e

# Sync workspace dependencies when a manifest changes on the host.
# --frozen-lockfile is tried first (fast, no lockfile changes);
# falls back to a full install if the lockfile is out of date.
cd /repo
pnpm install --frozen-lockfile --filter=ssrs-price-costs... 2>/dev/null \
  || pnpm install --filter=ssrs-price-costs...
cd /repo/apps/price-mgmt

exec "$@"

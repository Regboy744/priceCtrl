# PriceCtrl

Monorepo: backend (Express + scraping), frontend (Vue), price-mgmt (Express + Playwright), shared contracts.

## Layout

```
apps/
├── backend/       # Express + Puppeteer scrapers + HTTP order handlers
├── frontend/      # Vue 3 + Vite
└── price-mgmt/    # Express + Playwright SSRS scraper
packages/
└── contracts/     # Shared Zod schemas, types, permissions registry
```

## Prereqs

- Node >= 22.12
- pnpm >= 10

## Install

```bash
pnpm install
```

## Common commands

```bash
pnpm dev           # all apps in parallel
pnpm build         # build everything (contracts first)
pnpm typecheck     # type-check everything
pnpm lint          # lint everything
pnpm test          # run all tests

# Single app
pnpm --filter backend dev
pnpm --filter frontend build
pnpm --filter @pricectrl/contracts typecheck
```

## Contracts

`packages/contracts` is the shared kernel — Zod schemas + inferred types + permissions registry. Consumed by backend and frontend via `"@pricectrl/contracts": "workspace:*"`. Not published to any registry.

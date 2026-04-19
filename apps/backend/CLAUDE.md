# AGENTS.md

This file provides guidance to the Agents models AI when working with code in this repository.

## Build & Development Commands

```bash
pnpm dev          # Start development server with hot reload (tsx watch)
pnpm build        # Compile TypeScript to dist/
pnpm start        # Run compiled code (production)
pnpm lint         # Check code with Biome
pnpm lint:fix     # Auto-fix lint issues
pnpm format       # Format code with Biome
pnpm typecheck    # Type check without emitting
```

## Architecture Overview

This is a TypeScript/Express backend for scraping supplier product data. It uses Puppeteer with stealth plugins to log into supplier websites, extract product prices, and store them in Supabase.

### Core Structure

```
src/
├── index.ts                 # Entry point, server startup, graceful shutdown
├── app.ts                   # Express app factory with middleware setup
├── features/
│   ├── scraping/            # Core scraping orchestration
│   │   ├── base.scraper.ts  # Abstract base class all scrapers extend
│   │   ├── scraping.registry.ts  # Supplier scraper registration
│   │   ├── scraping.service.ts   # Orchestrates scrape jobs
│   │   ├── scraping.scheduler.ts # Cron-based scheduling
│   │   └── scraping.types.ts     # ScrapedProduct, ScrapeResult, etc.
│   ├── suppliers/           # Per-supplier implementations
│   │   ├── musgrave/        # Example: hybrid Puppeteer login + REST API
│   │   ├── barry-group/
│   │   ├── oreillys/
│   │   ├── savage-whitten/
│   │   └── value-centre/
│   └── health/              # Health check endpoints
└── shared/
    ├── config/env.ts        # Environment variable parsing
    ├── database/supabase.ts # Supabase client
    ├── services/
    │   ├── browser.service.ts  # Singleton Puppeteer browser with human-like behavior
    │   └── vault.service.ts    # Credential retrieval
    ├── middleware/          # Auth, error handling
    ├── errors/AppError.ts   # Custom error classes
    └── types/database.types.ts  # Supabase generated types
```

### Key Patterns

**Scraper Pattern**: Each supplier has a dedicated folder with:
- `*.config.ts` - URLs, selectors, timeouts
- `*.types.ts` - Supplier-specific types
- `*.scraper.ts` - Extends `BaseScraper`, implements `login()` and `scrapeProducts()`
- `*.parser.ts` - Transform raw data to `ScrapedProduct`

**BaseScraper**: Abstract class providing:
- Browser page management via `BrowserService`
- Human-like behavior helpers (delays, typing, mouse movements)
- Login retry logic with `performLoginWithRetry()`
- Common utilities: `navigateTo()`, `waitForSelector()`, `parsePrice()`

**BrowserService**: Singleton managing Puppeteer with:
- `puppeteer-extra` + stealth plugin for bot detection evasion
- Human-like mouse movements via bezier curves
- Variable typing speed with occasional "typos"
- Random user agents per session

**Scraping Modes**:
- `baseline`: First scrape for a company, stores prices in `supplier_products`
- `re-baseline`: Updates existing baseline prices
- `delta`: Compares to baseline, stores differences in `supplier_company_prices`

### Adding a New Supplier

1. Create folder: `src/features/suppliers/<supplier-name>/`
2. Add config, types, parser, and scraper files following existing patterns
3. Register in `scraping.registry.ts`

## Environment

Requires Node.js >= 20. Copy `.env.example` to `.env` and configure:
- Supabase credentials
- `SCRAPE_HEADLESS=true` for production
- `ENABLE_SCHEDULER=true` to enable cron jobs in development

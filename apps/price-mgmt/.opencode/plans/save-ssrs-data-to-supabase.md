# Save SSRS Scrape Data to Shared Supabase

## Goal

Persist SSRS price and cost data to the shared Supabase database so the retailCtrl SaaS platform can offer store-level price management as a feature. Data is company-scoped: managers, admins, and master users can access their company's SSRS data. The SSRS supplier column is stored as plain text and is not linked to the `suppliers` table.

Each company has a list of stores. Each store can have 30k+ products, so a company with 5 stores could have 150k+ product rows. Products overlap across stores but some stores may have more or fewer.

## Architecture Context

Three independent microservices share one Supabase database:

| Service | Role | Repo Path |
|---------|------|-----------|
| **front-end** | Vue SaaS dashboard, owns migrations | `/home/regboy/coding/retailCtrl/front-end` |
| **backend** | Supplier scraping, ordering, price checks | `/home/regboy/coding/retailCtrl/backend` |
| **ssrs-price-costs** | SSRS report scraping (this repo) | `/home/regboy/coding/retailCtrl/ssrs-price-costs` |

Migrations are managed in the frontend repo under `front-end/supabase/migrations/`.
The Supabase client pattern lives in `backend/src/shared/database/supabase.ts`.

## Data Model Decisions

- **Dedicated SSRS tables** — do not reuse `supplier_products` / `supplier_company_prices`.
- **Company-scoped** — each run is linked to a `company_id`.
- **Upsert latest-only** — one row per product per store per company, overwritten on each run.
- **No supplier FK** — the SSRS `supplier` column is stored as plain text.
- **`company_id` in request body** — passed directly for now; email-based resolution added later.
- **Slim run table** — `ssrs_scrape_runs` is a minimal parent/freshness tracker only. All operational logging (stats, errors, memory telemetry, requested stores, mode) stays in local job artifacts under `outputs/jobs/<jobId>/` as it does today.

## Progress Snapshot

- ✅ Step 1 completed in Supabase (`ssrs_scrape_runs` + `ssrs_store_products` exist with RLS, triggers, constraints)
- ✅ Step 2.1 completed in frontend (`src/types/shared/database.types.ts` contains both new tables)
- ✅ Steps 2.2 through 9 implemented in `ssrs-price-costs`
- ⏳ Remaining work is Step 10 validation after filling `.env` Supabase values

## Current Data Flow (before changes)

```
POST /api/v1/jobs/scrape
  → jobs.controller.ts → jobManager.createJob()
    → sweepService.execute()
      → runParallelJob() or runSequentialJob()
        → runCascadedSweep() / runParallelSweep()
          → per-page rows → csvAppender.appendRows()  ← writes to local CSV
```

The `onPageRows` callback in `sweep.ts:637-648` and the `csvAppender` in `parallel.ts:314-332` are the streaming insertion points.

---

## Step 1 — Supabase Migration (frontend repo) ✅ Done

**Repo:** `front-end`
**File to create:** `supabase/migrations/<timestamp>_create_ssrs_store_pricing_tables.sql`

### 1.1 Create `ssrs_scrape_runs` table

Minimal parent/freshness record. No stats, no error messages, no debug data — those stay in local job artifacts.

```sql
CREATE TABLE ssrs_scrape_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source_job_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    rows_upserted INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Purpose:
- `run_id` FK parent for `ssrs_store_products`.
- Lets the frontend know when the last scrape ran and whether it succeeded.
- `rows_upserted` gives a quick count without querying the products table.

### 1.2 Create `ssrs_store_products` table

```sql
CREATE TABLE ssrs_store_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES ssrs_scrape_runs(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    store_number TEXT NOT NULL,
    store_name TEXT NOT NULL,
    department_code TEXT,
    department_name TEXT,
    subdepartment_code TEXT,
    subdepartment_name TEXT,
    commodity_code TEXT,
    commodity_name TEXT,
    family_code TEXT,
    family_name TEXT,
    ean_plu TEXT NOT NULL,
    root_article_code TEXT NOT NULL,
    lu TEXT,
    lv TEXT,
    sv_code TEXT,
    description TEXT NOT NULL,
    size TEXT,
    must_stock TEXT,
    delisted TEXT,
    store_selling_price NUMERIC(12,4),
    cost_price NUMERIC(12,4),
    vat TEXT,
    case_qty TEXT,
    margin_percent TEXT,
    drs TEXT,
    supplier TEXT,
    article_linking TEXT,
    report_page INTEGER,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Upsert key: one row per product per store per company
    UNIQUE (company_id, store_number, ean_plu, root_article_code)
);
```

### 1.3 Create indexes

```sql
CREATE INDEX idx_ssrs_store_products_run ON ssrs_store_products(run_id);
CREATE INDEX idx_ssrs_store_products_location ON ssrs_store_products(location_id);
CREATE INDEX idx_ssrs_store_products_store ON ssrs_store_products(store_number);
CREATE INDEX idx_ssrs_store_products_ean ON ssrs_store_products(ean_plu);
CREATE INDEX idx_ssrs_store_products_article ON ssrs_store_products(root_article_code);

CREATE INDEX idx_ssrs_scrape_runs_company ON ssrs_scrape_runs(company_id);
```

### 1.4 Add `updated_at` trigger

```sql
CREATE TRIGGER trigger_ssrs_scrape_runs_updated_at
    BEFORE UPDATE ON ssrs_scrape_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_ssrs_store_products_updated_at
    BEFORE UPDATE ON ssrs_store_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 1.5 Enable RLS

```sql
ALTER TABLE ssrs_scrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_all_ssrs_scrape_runs" ON ssrs_scrape_runs
    FOR ALL TO authenticated USING (is_master());
CREATE POLICY "company_select_ssrs_scrape_runs" ON ssrs_scrape_runs
    FOR SELECT TO authenticated
    USING ((is_admin() OR is_manager()) AND company_id = get_user_company_id());

ALTER TABLE ssrs_store_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_all_ssrs_store_products" ON ssrs_store_products
    FOR ALL TO authenticated USING (is_master());
CREATE POLICY "company_select_ssrs_store_products" ON ssrs_store_products
    FOR SELECT TO authenticated
    USING ((is_admin() OR is_manager()) AND company_id = get_user_company_id());
```

### 1.6 Service role bypass

The `ssrs-price-costs` service uses the service-role key, which bypasses RLS. No additional write policies are needed for the scraper.

### Verification

After applying the migration:
- Confirm both tables exist in Supabase dashboard.
- Confirm RLS is enabled.
- Confirm the unique constraint on `ssrs_store_products` works.

---

## Step 2 — Regenerate Database Types

**Repo:** `front-end` only (backend does not need to be touched for this task)

### 2.1 Regenerate frontend types ✅ Done

Completed in frontend; `src/types/shared/database.types.ts` already includes `ssrs_scrape_runs` and `ssrs_store_products`.

### 2.2 Create minimal types for ssrs-price-costs

Create a lightweight types file in `ssrs-price-costs` (does not need the full generated types — just the insert/row shapes for the two new tables).

### Verification

- `pnpm build` passes in frontend.
- New table types appear in the frontend generated file.

---

## Step 3 — Add Supabase Dependency to `ssrs-price-costs`

**Repo:** `ssrs-price-costs`

### 3.1 Install `@supabase/supabase-js`

```bash
pnpm add @supabase/supabase-js
```

### 3.2 Add env vars to `.env.example`

```env
# Supabase (shared database — service role for server-side writes)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3.3 Update `src/config/env.ts`

Add to `AppEnvironment`:
```typescript
supabase: {
  url: string;
  serviceRoleKey: string;
};
```

Read from env:
```typescript
supabase: {
  url: process.env['SUPABASE_URL'] || '',
  serviceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] || '',
},
```

### Verification

- `pnpm build` passes.
- `pnpm exec tsc --noEmit` passes.

---

## Step 4 — Create Supabase Client Module

**Repo:** `ssrs-price-costs`
**File to create:** `src/integrations/supabase/client.ts`

### 4.1 Implement service-role client

Follow the same singleton pattern as `backend/src/shared/database/supabase.ts`:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseClient(url: string, serviceRoleKey: string): SupabaseClient {
  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return client;
}
```

### 4.2 Create SSRS insert/row types

**File to create:** `src/integrations/supabase/ssrs.types.ts`

Define `SsrsScrapeRunInsert`, `SsrsStoreProductUpsert`, and related shapes matching the migration columns.

### Verification

- `pnpm build` passes.
- `pnpm exec tsc --noEmit` passes.

---

## Step 5 — Create SSRS Persistence Service

**Repo:** `ssrs-price-costs`
**File to create:** `src/integrations/supabase/ssrs-persistence.service.ts`

### 5.1 Design the service interface

```typescript
export interface SsrsPersistenceService {
  /** Create a run record at job start. Returns the run UUID. */
  createRun(input: CreateRunInput): Promise<string>;

  /** Upsert a batch of product rows. Returns count of rows upserted. */
  upsertProductBatch(input: UpsertBatchInput): Promise<number>;

  /** Resolve location_id for a store number within the company. */
  resolveLocationId(companyId: string, storeNumber: string): Promise<string | null>;

  /** Finalize the run with status and rows_upserted count. */
  finalizeRun(input: FinalizeRunInput): Promise<void>;
}
```

### 5.2 Implement with batch upserts

Key behaviors:
- `upsertProductBatch` accepts `ProductRow[]` plus store metadata and `company_id` / `run_id`.
- Use Supabase `.upsert()` with `onConflict: 'company_id,store_number,ean_plu,root_article_code'`.
- Batch in chunks of 500 to stay under Supabase's default row limits.
- Convert string price fields to numeric before insert (e.g., strip `€` and parse).
- Cache `location_id` lookups per store number to avoid repeated queries.
- Log but do not hard-fail on persistence errors — the CSV fallback still works.

### 5.3 Location resolution

Query `locations` table:
```sql
SELECT id FROM locations
WHERE company_id = $1 AND location_number = $2::integer
LIMIT 1
```

If no match, set `location_id` to `null` and log a warning.

### Verification

- `pnpm build` passes.
- `pnpm exec tsc --noEmit` passes.

---

## Step 6 — Update Request Schema and Types

**Repo:** `ssrs-price-costs`

### 6.1 Update `SweepJobRequest` in `src/modules/sweep/sweep.types.ts`

Add:
```typescript
companyId?: string;
```

### 6.2 Update `SweepJobResult` in `src/modules/sweep/sweep.types.ts`

Add:
```typescript
supabaseRunId?: string;
supabaseRowsUpserted?: number;
unmatchedStoreCount?: number;
```

### 6.3 Update request schema in `src/api/schemas/job-schemas.ts`

Add parsing for `companyId` (required UUID string).

### Verification

- `pnpm build` passes.
- `pnpm exec tsc --noEmit` passes.

---

## Step 7 — Wire Persistence Into `AppContext`

**Repo:** `ssrs-price-costs`

### 7.1 Update `src/app-context.ts`

Add the persistence service to `AppContext`:
```typescript
ssrsPersistence: SsrsPersistenceService | null;
```

`null` when `SUPABASE_URL` is not configured (graceful degradation).

### 7.2 Update `src/app.ts`

In `createAppContext()`, instantiate the persistence service only if Supabase env vars are set:
```typescript
ssrsPersistence: env.supabase.url && env.supabase.serviceRoleKey
  ? createSsrsPersistenceService(env.supabase.url, env.supabase.serviceRoleKey)
  : null,
```

### 7.3 Update `SweepService` constructor

Pass the persistence service (or `null`) into `SweepService` so it can use it during job execution.

### Verification

- `pnpm build` passes.
- Service starts without Supabase vars (persistence disabled, CSV-only mode).
- Service starts with Supabase vars (persistence enabled).

---

## Step 8 — Hook Persistence Into Sweep Execution

**Repo:** `ssrs-price-costs`
**Files to modify:** `src/modules/sweep/sweep.service.ts`

This is the core integration step. The sweep service currently calls `csvAppender.appendRows()` to stream rows into CSV. We add a parallel Supabase upsert alongside it.

### 8.1 Sequential mode (`runSequentialJob`)

In `sweep.service.ts:135-245`:

1. At job start (before the scrape loop), call `persistence.createRun()` with `companyId`, `jobId`.
2. In the `onPageRows` callback inside `runCascadedSweep()` (`sweep.ts:637-648`), after `csvAppender.appendRows()`, call `persistence.upsertProductBatch()` with the enriched rows.
3. In the `finally` block (or after the sweep completes), call `persistence.finalizeRun()` with the final status and total rows upserted.
4. Add the Supabase metadata to the returned `SweepJobResult`.

### 8.2 Parallel mode (`runParallelJob`)

In `sweep.service.ts:248-347`:

The parallel flow delegates to `runParallelSweep()` in `parallel.ts`, where each store runs `processStore()` → `runCascadedSweep()` in its own tab. The `csvAppender` per store already streams rows via `onPageRows`.

**Approach (simpler, recommended for first pass):**
- Create one `ssrs_scrape_runs` record before parallel execution starts.
- Pass the persistence service into each store's sweep (via a new field on the sweep input).
- Each store's `onPageRows` callback calls `persistence.upsertProductBatch()` alongside `csvAppender.appendRows()`.
- After all stores finish, call `persistence.finalizeRun()`.

### 8.3 Integration points (file-level)

| File | Change |
|------|--------|
| `src/modules/sweep/sweep.service.ts` | Create/finalize runs, pass persistence to sweep |
| `src/scrape/sweep.ts` (sequential `onPageRows`) | Call upsert after CSV append |
| `src/scrape/parallel.ts` (parallel `processStore` → `runCascadedSweep`) | Pass persistence through, call upsert in `onPageRows` |
| `src/scrape/types.ts` | Add optional persistence callback to `SweepRunInput` / `ParallelSweepInput` |

### 8.4 Error handling

- Supabase upsert failures should be **logged but not thrown**.
- The CSV write is the primary output; Supabase is additive.
- Track failed upsert count in `SweepStats` or a separate counter.
- If `createRun` fails, skip all Supabase writes for that job (log once, then silence).

### Verification

- `pnpm build` passes.
- `pnpm exec tsc --noEmit` passes.

---

## Step 9 — Update Job Controller Response

**Repo:** `ssrs-price-costs`
**File:** `src/api/controllers/jobs.controller.ts`

The controller already returns `job.result` which includes `SweepJobResult`. After Step 6, the new fields (`supabaseRunId`, `supabaseRowsUpserted`, `unmatchedStoreCount`) will automatically appear in the response.

No controller changes needed unless we want to add `companyId` to the input preview (for the job list).

### Verification

- Start the server.
- `POST /api/v1/jobs/scrape` with `companyId` in the body returns `202`.
- `GET /api/v1/jobs/:id/result` includes Supabase metadata fields.

---

## Step 10 — End-to-End Validation

### 10.1 Small scrape test

```json
POST /api/v1/jobs/scrape
{
  "companyId": "<your-test-company-uuid>",
  "stores": ["1"],
  "headless": true,
  "autoLogin": true,
  "parallel": true,
  "maxParallelTabs": 1,
  "maxDepartments": 1,
  "maxSubdepartments": 1,
  "maxCommodities": 1,
  "maxFamilies": 1
}
```

### 10.2 Verify in Supabase

1. Query `ssrs_scrape_runs` — confirm one row with `status = 'completed'`.
2. Query `ssrs_store_products` — confirm product rows exist.
3. Confirm `location_id` is populated when `store_number` matches `locations.location_number`.
4. Confirm `company_id` is set correctly on all rows.
5. Run the same scrape again — confirm rows are **upserted** (not duplicated).

### 10.3 Build verification

```bash
pnpm build
pnpm exec tsc --noEmit
```

### 10.4 Graceful degradation

Remove `SUPABASE_URL` from `.env`, restart, trigger a scrape. Confirm:
- CSV output still works.
- No crash or unhandled errors.
- Logs indicate Supabase persistence is disabled.

---

## Files Changed Summary

### Frontend repo (`front-end`)

| File | Action |
|------|--------|
| `supabase/migrations/<timestamp>_create_ssrs_store_pricing_tables.sql` | **Create** |
| `src/types/shared/database.types.ts` | **Regenerate** |

### Backend repo (`backend`)

No changes needed for this task.

### SSRS repo (`ssrs-price-costs`)

| File | Action |
|------|--------|
| `package.json` | **Edit** — add `@supabase/supabase-js` |
| `.env.example` | **Edit** — add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `src/config/env.ts` | **Edit** — add `supabase` config block |
| `src/app-context.ts` | **Edit** — add `ssrsPersistence` field |
| `src/app.ts` | **Edit** — instantiate persistence service |
| `src/integrations/supabase/client.ts` | **Create** |
| `src/integrations/supabase/ssrs.types.ts` | **Create** |
| `src/integrations/supabase/ssrs-persistence.service.ts` | **Create** |
| `src/modules/sweep/sweep.types.ts` | **Edit** — add `companyId`, result fields |
| `src/modules/sweep/sweep.service.ts` | **Edit** — wire persistence into both job modes |
| `src/api/schemas/job-schemas.ts` | **Edit** — parse `companyId` |
| `src/scrape/types.ts` | **Edit** — add persistence callback to sweep inputs |
| `src/scrape/sweep.ts` | **Edit** — call persistence in `onPageRows` |
| `src/scrape/parallel.ts` | **Edit** — pass persistence through to sweep |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `store_number` may not match `locations.location_number` | `location_id` is nullable; log unmatched stores |
| Numeric fields arrive as strings from SSRS | Parse/sanitize before insert; strip `€`, convert `%` |
| Parallel tabs create many concurrent upserts | Batch in 500-row chunks; Supabase handles concurrent writes |
| Supabase outage during scrape | Persistence errors are logged, not thrown; CSV is fallback |
| Migration breaks existing tables | Dedicated tables only; no ALTER on existing tables |
| Service-role key leaked | Never log it; use `.env` only; add to `.gitignore` |

---

## Future Enhancements (out of scope for this plan)

- Email-based company resolution (replace `companyId` in body with email lookup).
- Frontend SSRS price management dashboard page.
- Price history tracking (append-only `ssrs_store_price_history` table).
- Correlation between SSRS `root_article_code` and `master_products.article_code`.
- Scheduled/automated SSRS scrapes triggered by cron.
- Location auto-creation when SSRS stores don't match existing `locations`.

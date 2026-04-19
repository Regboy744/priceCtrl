-- ============================================
-- SSRS SCRAPE RUNS TABLE
-- ============================================
-- Minimal parent/freshness record for SSRS scraping jobs.
-- No stats, no error messages, no debug data — those stay in local job artifacts.
-- Depends on: companies

CREATE TABLE ssrs_scrape_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source_job_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    raw_rows_inserted INTEGER NOT NULL DEFAULT 0,
    current_rows_merged INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ssrs_scrape_runs IS 'Parent record for SSRS scraping jobs. Tracks run status and freshness.';
COMMENT ON COLUMN ssrs_scrape_runs.source_job_id IS 'External job ID from the scraping system';
COMMENT ON COLUMN ssrs_scrape_runs.raw_rows_inserted IS 'Total rows inserted into raw staging table';
COMMENT ON COLUMN ssrs_scrape_runs.current_rows_merged IS 'Rows merged into current products table after deduplication';

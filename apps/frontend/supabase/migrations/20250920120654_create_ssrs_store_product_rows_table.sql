-- ============================================
-- SSRS STORE PRODUCT ROWS TABLE (RAW/STAGING)
-- ============================================
-- Append-only table for every scraped row from SSRS reports.
-- 100% of scraped data goes here first, then gets merged
-- into ssrs_store_products by the merge function.
-- Depends on: companies, ssrs_scrape_runs, locations

CREATE TABLE ssrs_store_product_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES ssrs_scrape_runs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    store_number TEXT NOT NULL,
    store_name TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    row_index INTEGER NOT NULL,
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
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ssrs_store_product_rows IS 'Raw scraped rows from SSRS reports. Append-only staging table.';
COMMENT ON COLUMN ssrs_store_product_rows.page_number IS 'SSRS report page number this row came from';
COMMENT ON COLUMN ssrs_store_product_rows.row_index IS 'Row position within the page (0-based)';

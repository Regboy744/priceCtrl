-- ============================================
-- SSRS STORE PRODUCTS TABLE
-- ============================================
-- Stores scraped product data from SSRS reports per store.
-- Depends on: companies, ssrs_scrape_runs, locations

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Upsert key: one row per product per store per company
    UNIQUE (company_id, store_number, ean_plu, root_article_code)
);

COMMENT ON TABLE ssrs_store_products IS 'Scraped product data from SSRS reports, one row per product per store per company';
COMMENT ON COLUMN ssrs_store_products.scraped_at IS 'When the data was actually scraped from the SSRS report';

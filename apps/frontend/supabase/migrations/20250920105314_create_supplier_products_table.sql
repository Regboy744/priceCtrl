-- 6. Supplier Products (depends on: suppliers, master_products, companies)
-- Stores baseline/reference prices for supplier products
-- These prices are scraped using one company's credentials per supplier
-- Company-specific negotiated prices that differ go in supplier_company_prices

DROP TABLE IF EXISTS supplier_products CASCADE;
CREATE TABLE supplier_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    master_product_id UUID NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
    supplier_product_code TEXT,
    internal_product_id TEXT,
    current_price DECIMAL(12,4) NOT NULL CHECK (current_price > 0),
    vat_rate DECIMAL(5,4) DEFAULT 0.0000 CHECK (vat_rate >= 0 AND vat_rate <= 100),
    availability_status TEXT DEFAULT 'available',

    -- Per-consumer-unit cost (VAT incl) published by supplier; ranking field for price comparison.
    unit_cost_incl_vat DECIMAL(12,4) NULL,
    -- Number of consumer units per case/pack (e.g. 12 for a case of 12).
    pack_count INT NULL CHECK (pack_count IS NULL OR pack_count > 0),
    -- Raw per-unit size string as scraped ("60gm", "1.25l", "40 x 125 g"). Display + audit only — not normalized.
    pack_unit_size TEXT NULL,

    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    -- Track which company's credentials were used to scrape this baseline price
    -- NULL if unknown or scraped with a neutral/demo account
    scraped_from_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    
    UNIQUE(supplier_id, master_product_id, supplier_product_code)
);

COMMENT ON TABLE supplier_products IS 'Baseline/reference prices from suppliers. Scraped using one company account per supplier.';
COMMENT ON COLUMN supplier_products.current_price IS 'Baseline price used for comparison. May be from a specific company account.';
COMMENT ON COLUMN supplier_products.scraped_from_company_id IS 'Company whose credentials were used to scrape this baseline price. NULL if neutral account.';
COMMENT ON COLUMN supplier_products.internal_product_id IS 'Internal product ID from supplier system (required for S&W).';
COMMENT ON COLUMN supplier_products.unit_cost_incl_vat IS 'Supplier-published per-consumer-unit cost (VAT incl). Primary comparison field for pricing RPC. NULL when scraper could not extract.';
COMMENT ON COLUMN supplier_products.pack_count IS 'Consumer units per case/pack (e.g. 12). NULL when unknown.';
COMMENT ON COLUMN supplier_products.pack_unit_size IS 'Raw per-unit size string from supplier listing. Not normalized — display + audit only.';


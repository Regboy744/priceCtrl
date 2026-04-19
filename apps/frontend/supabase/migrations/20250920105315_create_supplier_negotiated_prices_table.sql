-- ============================================
-- SUPPLIER NEGOTIATED PRICES TABLE
-- ============================================
-- 6.1 Supplier Negotiated Prices (depends on: suppliers, companies, master_products)
-- This table stores negotiated/special prices between suppliers and companies
-- Only stores exceptions - most products use default pricing from supplier_products
-- Storage efficient: only 100-1000 rows per supplier per company (vs 30k default catalog)

CREATE TABLE supplier_company_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    master_product_id UUID NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
    supplier_product_code TEXT NOT NULL,
    negotiated_price DECIMAL(12,4) NOT NULL CHECK (negotiated_price > 0),
    valid_from TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    valid_until TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supplier_id, company_id, master_product_id, supplier_product_code),
    CHECK (valid_until IS NULL OR valid_until > valid_from)
);

COMMENT ON TABLE supplier_company_prices IS 'Stores company-specific negotiated prices that override default catalog prices';
COMMENT ON COLUMN supplier_company_prices.negotiated_price IS 'Special price negotiated between supplier and company';
COMMENT ON COLUMN supplier_company_prices.valid_from IS 'When this special price becomes active';
COMMENT ON COLUMN supplier_company_prices.valid_until IS 'When this special price expires (NULL = no expiration)';
COMMENT ON COLUMN supplier_company_prices.notes IS 'Reason for special pricing (e.g., "Q1 2025 contract", "Volume discount")';

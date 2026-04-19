-- ============================================
-- COMPANY SUPPLIER SETTINGS TABLE
-- ============================================
-- Stores price comparison threshold percentages per company per supplier
-- Example: Company "SuperMart" sets 3% threshold for "Musgrave", 6% for "Barry Group"

CREATE TABLE company_supplier_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    
    -- Price comparison threshold (e.g., 3.00 means 3%)
    -- 0 = exact match required, higher = more tolerance
    threshold_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00
        CHECK (threshold_percentage >= 0 AND threshold_percentage <= 100),

    -- Toggle for negotiated/special pricing per company-supplier
    special_pricing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One setting per company-supplier combination
    UNIQUE(company_id, supplier_id)
);

COMMENT ON TABLE company_supplier_settings IS 
    'Price comparison threshold settings per company per supplier';
COMMENT ON COLUMN company_supplier_settings.threshold_percentage IS 
    'Percentage threshold for price comparison (0-100). 0 = exact match';
COMMENT ON COLUMN company_supplier_settings.special_pricing_enabled IS 
    'Whether negotiated/special pricing is active for this company-supplier';

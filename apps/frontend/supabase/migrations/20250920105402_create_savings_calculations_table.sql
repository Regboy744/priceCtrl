-- 12. Savings Calculations (depends on: order_items, suppliers, companies)
DROP TABLE IF EXISTS savings_calculations CASCADE;
CREATE TABLE savings_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    baseline_price DECIMAL(12,4) NOT NULL CHECK (baseline_price > 0),
    chosen_supplier_id UUID NOT NULL REFERENCES suppliers(id),
    chosen_price DECIMAL(12,4) NOT NULL CHECK (chosen_price > 0),
    best_external_supplier_id UUID REFERENCES suppliers(id),
    best_external_price DECIMAL(12,4) CHECK (best_external_price > 0),
    delta_vs_baseline DECIMAL(15,4),
    is_saving BOOLEAN GENERATED ALWAYS AS (delta_vs_baseline < 0) STORED,
    savings_percentage DECIMAL(5,4) CHECK (savings_percentage >= -1 AND savings_percentage <= 1),
    calculation_date TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN savings_calculations.company_id IS 'Denormalized company_id for fast RLS tenant isolation (best practice for multi-tenant)';
COMMENT ON COLUMN savings_calculations.baseline_price IS 'The price from uploaded invoice at time of comparison';
COMMENT ON COLUMN savings_calculations.chosen_supplier_id IS 'The supplier actually chosen for this order item';
COMMENT ON COLUMN savings_calculations.chosen_price IS 'The price paid to the chosen supplier';
COMMENT ON COLUMN savings_calculations.best_external_supplier_id IS 'The external supplier with the best price';
COMMENT ON COLUMN savings_calculations.best_external_price IS 'The best external supplier price';
COMMENT ON COLUMN savings_calculations.delta_vs_baseline IS 'Difference: chosen_price - baseline_price (negative = savings)';
COMMENT ON COLUMN savings_calculations.is_saving IS 'Auto-computed: true when delta_vs_baseline < 0 (we saved money)';
COMMENT ON COLUMN savings_calculations.savings_percentage IS 'Savings as fraction of baseline (e.g. 0.1234 = 12.34% savings)';

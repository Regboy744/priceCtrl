-- 7. Supplier Price History (depends on: supplier_products)
DROP TABLE IF EXISTS supplier_price_history CASCADE;
CREATE TABLE supplier_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_product_id UUID NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
    old_price DECIMAL(12,4) CHECK (old_price >= 0),
    new_price DECIMAL(12,4) CHECK (new_price >= 0),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by UUID REFERENCES user_profiles(id),
    effective_from TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    effective_to TIMESTAMPTZ,
    change_reason TEXT
);

COMMENT ON COLUMN supplier_price_history.changed_by IS 'User who triggered the price change';
COMMENT ON COLUMN supplier_price_history.effective_from IS 'Timestamp when this price became effective';
COMMENT ON COLUMN supplier_price_history.effective_to IS 'Timestamp when this price was superseded (null for current)';

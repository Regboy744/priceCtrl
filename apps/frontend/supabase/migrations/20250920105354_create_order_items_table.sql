-- 11. Order Items (depends on: orders, master_products, supplier_products)
DROP TABLE IF EXISTS order_items CASCADE;
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    master_product_id UUID NOT NULL REFERENCES master_products(id),
    supplier_product_id UUID NOT NULL REFERENCES supplier_products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12,4) NOT NULL CHECK (unit_price > 0),
    total_price DECIMAL(15,4) NOT NULL CHECK (total_price > 0),
    baseline_unit_price DECIMAL(12,4),
    override_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


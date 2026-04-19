-- 10. Orders (depends on: locations, user_profiles, suppliers)
DROP TABLE IF EXISTS orders CASCADE;
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    order_date DATE NOT NULL,
    total_amount DECIMAL(15,4) CHECK (total_amount >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


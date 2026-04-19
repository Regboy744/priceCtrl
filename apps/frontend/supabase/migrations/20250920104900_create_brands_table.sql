-- 0. Brands (Reference table for company brands)
-- This table stores all available brands (SuperValu, Centra, etc.)
-- Companies reference this table, and master_products are linked to brands

DROP TABLE IF EXISTS brands CASCADE;
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE brands IS 'Reference table for retail brands (SuperValu, Centra, etc.)';
COMMENT ON COLUMN brands.name IS 'Brand name - must be unique';

-- 3. Master Products (Product catalog)
-- Links brand's article_code to supplier's ean_code
-- Each brand has its own set of article_codes

DROP TABLE IF EXISTS master_products CASCADE;
CREATE TABLE master_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id),
    article_code TEXT NOT NULL,
    ean_code TEXT NOT NULL,
    ean_history JSONB DEFAULT '[]',
    description TEXT NOT NULL,
    account TEXT,
    unit_size TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: article_code must be unique within each brand
    CONSTRAINT master_products_brand_article_unique UNIQUE (brand_id, article_code)
);

COMMENT ON TABLE master_products IS 'Maps brand article_codes to supplier ean_codes';
COMMENT ON COLUMN master_products.brand_id IS 'Reference to the brand (SuperValu, Centra, etc.)';
COMMENT ON COLUMN master_products.article_code IS 'Brand internal product code';
COMMENT ON COLUMN master_products.ean_code IS 'Current EAN/barcode used by suppliers';
COMMENT ON COLUMN master_products.ean_history IS 'Array of previously used EAN codes for this article';

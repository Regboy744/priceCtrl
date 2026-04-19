-- ============================================
-- PRICING COMPARISON FUNCTIONS (SUPPLIERS vs NEGOTIATED)
-- ============================================
-- Returns one row per supplier product with negotiated price override when available.

-- ============================================
-- Function: Get Pricing Comparison (Flat Rows)
-- ============================================
CREATE OR REPLACE FUNCTION get_pricing_comparison(
    p_company_id UUID,
    p_supplier_ids UUID[] DEFAULT NULL,
    p_product_ids UUID[] DEFAULT NULL,
    p_include_unavailable BOOLEAN DEFAULT FALSE,
    p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
    product_id UUID,
    article_code TEXT,
    description TEXT,
    ean_code TEXT,
    unit_size TEXT,
    supplier_id UUID,
    supplier_name TEXT,
    is_active BOOLEAN,
    final_price NUMERIC,
    catalog_price NUMERIC,
    is_special_price BOOLEAN,
    special_price_notes TEXT,
    valid_until TIMESTAMPTZ,
    availability_status TEXT,
    supplier_product_code TEXT,
    internal_product_id TEXT,
    unit_cost_incl_vat NUMERIC,
    pack_count INT,
    pack_unit_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mp.id,
        mp.article_code,
        mp.description,
        mp.ean_code,
        mp.unit_size,
        s.id,
        s.name,
        s.is_active,
        COALESCE(scp.negotiated_price, sp.current_price) as final_price,
        sp.current_price as catalog_price,
        (scp.negotiated_price IS NOT NULL) as is_special_price,
        scp.notes,
        scp.valid_until,
        sp.availability_status,
        sp.supplier_product_code,
        sp.internal_product_id,
        sp.unit_cost_incl_vat,
        sp.pack_count,
        sp.pack_unit_size
    FROM master_products mp
    JOIN supplier_products sp ON sp.master_product_id = mp.id
    JOIN suppliers s ON s.id = sp.supplier_id
    LEFT JOIN supplier_company_prices scp 
        ON scp.supplier_id = sp.supplier_id 
        AND scp.master_product_id = sp.master_product_id
        AND scp.supplier_product_code = sp.supplier_product_code
        AND scp.company_id = p_company_id
        AND scp.valid_from <= NOW()
        AND (scp.valid_until IS NULL OR scp.valid_until > NOW())
    WHERE mp.is_active = true
        AND (p_supplier_ids IS NULL OR s.id = ANY(p_supplier_ids))
        AND (p_product_ids IS NULL OR mp.id = ANY(p_product_ids))
        AND (p_include_unavailable OR sp.availability_status = 'available')
    ORDER BY mp.article_code, s.name
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_pricing_comparison IS 'Returns pricing comparison table with one row per product-supplier (flat format for frontend transformation)';

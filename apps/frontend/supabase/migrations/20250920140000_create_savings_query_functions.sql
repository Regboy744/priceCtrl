-- PHASE 8: SAVINGS QUERY FUNCTIONS
-- ============================================
-- This migration creates SQL functions for querying savings data
-- across different dimensions with date range filtering.
-- Updated to support baseline pricing model
-- 
-- Dependencies:
--   - savings_calculations table
--   - order_items table
--   - orders table
--   - locations table
--   - companies table
--   - user_profiles table
--   - suppliers table
--   - master_products table

-- ============================================
-- Function 1: Get savings by company
-- ============================================
CREATE OR REPLACE FUNCTION get_savings_by_company(
  p_company_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  brand TEXT,
  total_savings_vs_baseline NUMERIC,
  total_overspend_vs_baseline NUMERIC,
  net_savings NUMERIC,
  avg_savings_percentage NUMERIC,
  savings_count BIGINT,
  overspend_count BIGINT,
  calculation_count BIGINT,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.brand,
    COALESCE(SUM(CASE WHEN sc.delta_vs_baseline < 0 THEN ABS(sc.delta_vs_baseline) ELSE 0 END), 0)::NUMERIC,
    COALESCE(SUM(CASE WHEN sc.delta_vs_baseline > 0 THEN sc.delta_vs_baseline ELSE 0 END), 0)::NUMERIC,
    COALESCE(SUM(sc.delta_vs_baseline * -1), 0)::NUMERIC,
    COALESCE(AVG(sc.savings_percentage), 0)::NUMERIC,
    COUNT(sc.id) FILTER (WHERE sc.is_saving = true),
    COUNT(sc.id) FILTER (WHERE sc.is_saving = false),
    COUNT(sc.id),
    p_start_date,
    p_end_date
  FROM companies c
  LEFT JOIN locations l ON l.company_id = c.id
  LEFT JOIN orders o ON o.location_id = l.id
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN savings_calculations sc ON sc.order_item_id = oi.id
    AND sc.calculation_date >= p_start_date
    AND sc.calculation_date <= p_end_date
  WHERE c.id = p_company_id
  GROUP BY c.id, c.name, c.brand;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================
-- Function 2: Get savings by location
-- ============================================
CREATE OR REPLACE FUNCTION get_savings_by_location(
  p_location_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  location_id UUID,
  location_name TEXT,
  location_type TEXT,
  company_id UUID,
  company_name TEXT,
  total_savings_vs_baseline NUMERIC,
  total_overspend_vs_baseline NUMERIC,
  net_savings NUMERIC,
  avg_savings_percentage NUMERIC,
  savings_count BIGINT,
  overspend_count BIGINT,
  calculation_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l.location_type,
    c.id,
    c.name,
    COALESCE(SUM(CASE WHEN sc.delta_vs_baseline < 0 THEN ABS(sc.delta_vs_baseline) ELSE 0 END), 0)::NUMERIC,
    COALESCE(SUM(CASE WHEN sc.delta_vs_baseline > 0 THEN sc.delta_vs_baseline ELSE 0 END), 0)::NUMERIC,
    COALESCE(SUM(sc.delta_vs_baseline * -1), 0)::NUMERIC,
    COALESCE(AVG(sc.savings_percentage), 0)::NUMERIC,
    COUNT(sc.id) FILTER (WHERE sc.is_saving = true),
    COUNT(sc.id) FILTER (WHERE sc.is_saving = false),
    COUNT(sc.id)
  FROM locations l
  JOIN companies c ON l.company_id = c.id
  LEFT JOIN orders o ON o.location_id = l.id
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN savings_calculations sc ON sc.order_item_id = oi.id
    AND sc.calculation_date >= p_start_date
    AND sc.calculation_date <= p_end_date
  WHERE l.id = p_location_id
  GROUP BY l.id, l.name, l.location_type, c.id, c.name;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================
-- Function 3: Get savings by supplier
-- ============================================
CREATE OR REPLACE FUNCTION get_savings_by_supplier(
  p_supplier_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  supplier_id UUID,
  supplier_name TEXT,
  is_active BOOLEAN,
  total_delta_vs_baseline NUMERIC,
  avg_savings_percentage NUMERIC,
  times_chosen BIGINT,
  total_order_value NUMERIC,
  savings_count BIGINT,
  overspend_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.is_active,
    COALESCE(SUM(sc.delta_vs_baseline * -1), 0)::NUMERIC,
    COALESCE(AVG(sc.savings_percentage), 0)::NUMERIC,
    COUNT(sc.id),
    COALESCE(SUM(sc.chosen_price * oi.quantity), 0)::NUMERIC,
    COUNT(sc.id) FILTER (WHERE sc.is_saving = true),
    COUNT(sc.id) FILTER (WHERE sc.is_saving = false)
  FROM suppliers s
  LEFT JOIN savings_calculations sc ON sc.chosen_supplier_id = s.id
    AND sc.calculation_date >= p_start_date
    AND sc.calculation_date <= p_end_date
  LEFT JOIN order_items oi ON sc.order_item_id = oi.id
  WHERE s.id = p_supplier_id
  GROUP BY s.id, s.name, s.is_active;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================
-- Function 4: Get savings by user
-- ============================================
CREATE OR REPLACE FUNCTION get_savings_by_user(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  total_savings NUMERIC,
  avg_savings_percentage NUMERIC,
  orders_created BIGINT,
  total_order_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.first_name || ' ' || up.last_name,
    COALESCE(SUM(sc.delta_vs_baseline * -1), 0)::NUMERIC,
    COALESCE(AVG(sc.savings_percentage), 0)::NUMERIC,
    COUNT(DISTINCT o.id),
    COALESCE(SUM(o.total_amount), 0)::NUMERIC
  FROM user_profiles up
  LEFT JOIN orders o ON o.created_by = up.id
    AND o.order_date >= p_start_date::DATE
    AND o.order_date <= p_end_date::DATE
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN savings_calculations sc ON sc.order_item_id = oi.id
  WHERE up.id = p_user_id
  GROUP BY up.id, up.first_name, up.last_name;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================
-- Function 5: Get savings by account
-- ============================================
CREATE OR REPLACE FUNCTION get_savings_by_account(
  p_company_id UUID,
  p_account TEXT,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  account TEXT,
  total_savings NUMERIC,
  avg_savings_percentage NUMERIC,
  calculation_count BIGINT,
  total_products BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    mp.account,
    COALESCE(SUM(sc.delta_vs_baseline * -1), 0)::NUMERIC,
    COALESCE(AVG(sc.savings_percentage), 0)::NUMERIC,
    COUNT(sc.id),
    COUNT(DISTINCT mp.id)
  FROM companies c
  LEFT JOIN locations l ON l.company_id = c.id
  LEFT JOIN orders o ON o.location_id = l.id
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN master_products mp ON oi.master_product_id = mp.id
  LEFT JOIN savings_calculations sc ON sc.order_item_id = oi.id
    AND sc.calculation_date >= p_start_date
    AND sc.calculation_date <= p_end_date
  WHERE c.id = p_company_id
    AND mp.account = p_account
  GROUP BY c.id, c.name, mp.account;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================
-- Function 6: Get all accounts for a company
-- ============================================
CREATE OR REPLACE FUNCTION get_company_accounts(
  p_company_id UUID
)
RETURNS TABLE (
  account TEXT,
  product_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.account,
    COUNT(DISTINCT mp.id)
  FROM master_products mp
  WHERE mp.account IS NOT NULL
  GROUP BY mp.account
  ORDER BY mp.account;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================
-- Function 7: Get savings by location AND account
-- ============================================
CREATE OR REPLACE FUNCTION get_savings_by_location_and_account(
  p_location_id UUID,
  p_account TEXT,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  location_id UUID,
  location_name TEXT,
  company_name TEXT,
  account TEXT,
  total_savings NUMERIC,
  avg_savings_percentage NUMERIC,
  calculation_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    c.name,
    mp.account,
    COALESCE(SUM(sc.delta_vs_baseline * -1), 0)::NUMERIC,
    COALESCE(AVG(sc.savings_percentage), 0)::NUMERIC,
    COUNT(sc.id)
  FROM locations l
  JOIN companies c ON l.company_id = c.id
  LEFT JOIN orders o ON o.location_id = l.id
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN master_products mp ON oi.master_product_id = mp.id
  LEFT JOIN savings_calculations sc ON sc.order_item_id = oi.id
    AND sc.calculation_date >= p_start_date
    AND sc.calculation_date <= p_end_date
  WHERE l.id = p_location_id
    AND mp.account = p_account
  GROUP BY l.id, l.name, c.name, mp.account;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================
-- Function 8: Get order details with savings
-- ============================================
CREATE OR REPLACE FUNCTION get_order_savings_detail(
  p_order_id UUID
)
RETURNS TABLE (
  order_id UUID,
  order_date DATE,
  location_name TEXT,
  order_item_id UUID,
  product_description TEXT,
  baseline_price NUMERIC,
  chosen_price NUMERIC,
  best_external_price NUMERIC,
  quantity INTEGER,
  delta_vs_baseline NUMERIC,
  is_saving BOOLEAN,
  savings_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_date,
    l.name,
    oi.id,
    mp.description,
    sc.baseline_price,
    sc.chosen_price,
    sc.best_external_price,
    oi.quantity,
    sc.delta_vs_baseline,
    sc.is_saving,
    sc.savings_percentage
  FROM orders o
  JOIN locations l ON o.location_id = l.id
  JOIN order_items oi ON oi.order_id = o.id
  JOIN master_products mp ON oi.master_product_id = mp.id
  LEFT JOIN savings_calculations sc ON sc.order_item_id = oi.id
  WHERE o.id = p_order_id
  ORDER BY mp.description;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- COMMENT DOCUMENTATION
-- ============================================
COMMENT ON FUNCTION get_savings_by_company IS 'Returns total savings vs baseline for a company within a date range';
COMMENT ON FUNCTION get_savings_by_location IS 'Returns total savings vs baseline for a specific location within a date range';
COMMENT ON FUNCTION get_savings_by_supplier IS 'Returns performance metrics for a supplier';
COMMENT ON FUNCTION get_savings_by_user IS 'Returns total savings generated by a specific user within a date range';
COMMENT ON FUNCTION get_savings_by_account IS 'Returns total savings for a specific account category within a company and date range';
COMMENT ON FUNCTION get_company_accounts IS 'Returns list of all unique account categories used by products';
COMMENT ON FUNCTION get_savings_by_location_and_account IS 'Returns savings for a location filtered by account category and date range';
COMMENT ON FUNCTION get_order_savings_detail IS 'Returns line-by-line savings detail for a specific order';

-- ============================================
-- SSRS MERGE FUNCTION
-- ============================================
-- Merges raw scraped rows from a single run into
-- the current products table (ssrs_store_products).
-- Deduplicates by (company_id, store_number, ean_plu, root_article_code),
-- keeping the row from the latest page/row_index.

CREATE OR REPLACE FUNCTION merge_ssrs_run_to_current(p_run_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  merged_count INTEGER;
BEGIN
  WITH deduped AS (
    SELECT DISTINCT ON (company_id, store_number, ean_plu, root_article_code)
      run_id, company_id, location_id, store_number, store_name,
      department_code, department_name,
      subdepartment_code, subdepartment_name,
      commodity_code, commodity_name,
      family_code, family_name,
      ean_plu, root_article_code,
      lu, lv, sv_code, description, size,
      must_stock, delisted,
      store_selling_price, cost_price,
      vat, case_qty, margin_percent, drs,
      supplier, article_linking,
      scraped_at
    FROM ssrs_store_product_rows
    WHERE run_id = p_run_id
    ORDER BY company_id, store_number, ean_plu, root_article_code,
             page_number DESC, row_index DESC
  )
  INSERT INTO ssrs_store_products (
    run_id, company_id, location_id, store_number, store_name,
    department_code, department_name,
    subdepartment_code, subdepartment_name,
    commodity_code, commodity_name,
    family_code, family_name,
    ean_plu, root_article_code,
    lu, lv, sv_code, description, size,
    must_stock, delisted,
    store_selling_price, cost_price,
    vat, case_qty, margin_percent, drs,
    supplier, article_linking,
    scraped_at
  )
  SELECT
    run_id, company_id, location_id, store_number, store_name,
    department_code, department_name,
    subdepartment_code, subdepartment_name,
    commodity_code, commodity_name,
    family_code, family_name,
    ean_plu, root_article_code,
    lu, lv, sv_code, description, size,
    must_stock, delisted,
    store_selling_price, cost_price,
    vat, case_qty, margin_percent, drs,
    supplier, article_linking,
    scraped_at
  FROM deduped
  ON CONFLICT (company_id, store_number, ean_plu, root_article_code)
  DO UPDATE SET
    run_id = EXCLUDED.run_id,
    location_id = EXCLUDED.location_id,
    store_name = EXCLUDED.store_name,
    department_code = EXCLUDED.department_code,
    department_name = EXCLUDED.department_name,
    subdepartment_code = EXCLUDED.subdepartment_code,
    subdepartment_name = EXCLUDED.subdepartment_name,
    commodity_code = EXCLUDED.commodity_code,
    commodity_name = EXCLUDED.commodity_name,
    family_code = EXCLUDED.family_code,
    family_name = EXCLUDED.family_name,
    lu = EXCLUDED.lu,
    lv = EXCLUDED.lv,
    sv_code = EXCLUDED.sv_code,
    description = EXCLUDED.description,
    size = EXCLUDED.size,
    must_stock = EXCLUDED.must_stock,
    delisted = EXCLUDED.delisted,
    store_selling_price = EXCLUDED.store_selling_price,
    cost_price = EXCLUDED.cost_price,
    vat = EXCLUDED.vat,
    case_qty = EXCLUDED.case_qty,
    margin_percent = EXCLUDED.margin_percent,
    drs = EXCLUDED.drs,
    supplier = EXCLUDED.supplier,
    article_linking = EXCLUDED.article_linking,
    scraped_at = EXCLUDED.scraped_at;

  GET DIAGNOSTICS merged_count = ROW_COUNT;
  RETURN merged_count;
END;
$$;

COMMENT ON FUNCTION merge_ssrs_run_to_current IS 'Deduplicates raw SSRS rows for a run and upserts them into the current products table';

-- PHASE 5: ALL PERFORMANCE INDEXES
-- ============================================
-- All indexes are consolidated in this single file for easier maintenance

-- ============================================
-- UNIQUE INDEXES (Constraints)
-- ============================================

-- Suppliers: all suppliers have unique names
CREATE UNIQUE INDEX suppliers_name_unique ON suppliers(name);

-- ============================================
-- BASIC INDEXES
-- ============================================

-- Brands indexes
CREATE INDEX idx_brands_active ON brands(id) WHERE is_active = true;

-- Master Products indexes
CREATE INDEX idx_master_products_brand ON master_products(brand_id);
CREATE INDEX idx_master_products_ean ON master_products(ean_code);
CREATE INDEX idx_master_products_article ON master_products(article_code);
CREATE INDEX idx_master_products_brand_article ON master_products(brand_id, article_code);
CREATE INDEX idx_master_products_description ON master_products USING GIN(to_tsvector('english', description));

-- Supplier indexes
CREATE INDEX idx_suppliers_active ON suppliers(is_active) WHERE is_active = true;

-- Supplier Products indexes  
CREATE INDEX idx_supplier_products_master ON supplier_products(master_product_id);
CREATE INDEX idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX idx_supplier_products_price ON supplier_products(current_price);
CREATE INDEX idx_supplier_products_updated ON supplier_products(last_updated);
CREATE INDEX idx_supplier_products_scraped_from ON supplier_products(scraped_from_company_id) 
    WHERE scraped_from_company_id IS NOT NULL;

-- Supplier Price History indexes
CREATE INDEX idx_supplier_price_history_temporal ON supplier_price_history(supplier_product_id, effective_from DESC);
CREATE INDEX idx_supplier_price_history_changed_by ON supplier_price_history(changed_by) WHERE changed_by IS NOT NULL;
CREATE INDEX idx_price_history_date ON supplier_price_history(changed_at);

-- Supplier Negotiated Prices indexes
CREATE INDEX idx_supplier_negotiated_prices_lookup ON supplier_company_prices(company_id, supplier_id, master_product_id, supplier_product_code);
CREATE INDEX idx_supplier_negotiated_prices_supplier_product ON supplier_company_prices(supplier_id, master_product_id, supplier_product_code);
CREATE INDEX idx_supplier_negotiated_prices_company ON supplier_company_prices(company_id);
CREATE INDEX idx_supplier_negotiated_prices_expiring ON supplier_company_prices(valid_until) WHERE valid_until IS NOT NULL;
CREATE INDEX idx_supplier_negotiated_prices_temporal ON supplier_company_prices(valid_from, valid_until);

-- Multi-tenant indexes
CREATE INDEX idx_locations_company ON locations(company_id);
CREATE INDEX idx_user_profiles_company ON user_profiles(company_id);
CREATE INDEX idx_user_profiles_location ON user_profiles(location_id);
CREATE INDEX idx_orders_location ON orders(location_id);

-- Time-based indexes
CREATE INDEX idx_orders_date ON orders(order_date);

-- Relationship indexes
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(master_product_id);
CREATE INDEX idx_order_items_baseline_price ON order_items(baseline_unit_price) WHERE baseline_unit_price IS NOT NULL;

-- Savings Calculations indexes
CREATE INDEX idx_savings_company_id ON savings_calculations(company_id);
CREATE INDEX idx_savings_order_item ON savings_calculations(order_item_id);
CREATE INDEX idx_savings_chosen_supplier ON savings_calculations(chosen_supplier_id);
CREATE INDEX idx_savings_best_external ON savings_calculations(best_external_supplier_id) WHERE best_external_supplier_id IS NOT NULL;
CREATE INDEX idx_savings_is_saving ON savings_calculations(is_saving) WHERE is_saving = true;
CREATE INDEX idx_savings_date ON savings_calculations(calculation_date);


-- ============================================
-- COMPOSITE INDEXES
-- ============================================

-- 1. Store-based date range queries (HIGH PRIORITY)
-- For queries like: "Get all orders for this location in date range" 
CREATE INDEX idx_orders_location_date ON orders(location_id, order_date);

-- 3. Price comparison queries
-- For queries like: "Compare prices for same product across suppliers"
CREATE INDEX idx_supplier_products_product_supplier ON supplier_products(master_product_id, supplier_id);

-- 4. Billing and feature access queries
-- For queries like: "Get companies by subscription tier"
CREATE INDEX idx_companies_subscription_tier ON companies(id, subscription_tier);

-- 4.1 Companies by brand (for fetching master products)
CREATE INDEX idx_companies_brand ON companies(brand_id) WHERE brand_id IS NOT NULL;

-- 5. Savings queries (PRODUCTION CRITICAL)
-- For queries like: "Get all savings for orders in date range"
CREATE INDEX idx_savings_date_is_saving ON savings_calculations(calculation_date, is_saving);

-- PARTIAL INDEXES
-- ============================================

-- 1. Active companies (most common queries focus on active companies)
-- Much smaller index since it excludes inactive companies
CREATE INDEX idx_companies_active ON companies(id) WHERE is_active = true;

-- 4. Active suppliers (for price comparison queries)
CREATE INDEX idx_suppliers_active_lookup ON suppliers(id, name) WHERE is_active = true;

-- 5. Available supplier products (for active pricing queries)
-- Excludes discontinued/out of stock items
CREATE INDEX idx_supplier_products_available ON supplier_products(master_product_id, current_price) WHERE availability_status = 'available';

-- ============================================
-- CONFIG TABLES INDEXES
-- ============================================

-- Company Supplier Settings indexes
CREATE INDEX idx_company_supplier_settings_company 
    ON company_supplier_settings(company_id);
CREATE INDEX idx_company_supplier_settings_supplier 
    ON company_supplier_settings(supplier_id);
CREATE INDEX idx_company_supplier_settings_lookup 
    ON company_supplier_settings(company_id, supplier_id);
CREATE INDEX idx_company_supplier_settings_active 
    ON company_supplier_settings(company_id) WHERE is_active = true;

-- Location Supplier Credentials indexes
CREATE INDEX idx_location_supplier_credentials_company 
    ON location_supplier_credentials(company_id);
CREATE INDEX idx_location_supplier_credentials_location 
    ON location_supplier_credentials(location_id);
CREATE INDEX idx_location_supplier_credentials_supplier 
    ON location_supplier_credentials(supplier_id);
CREATE INDEX idx_location_supplier_credentials_lookup 
    ON location_supplier_credentials(location_id, supplier_id);
CREATE INDEX idx_location_supplier_credentials_active 
    ON location_supplier_credentials(company_id) WHERE is_active = true;
CREATE INDEX idx_location_supplier_credentials_failed 
    ON location_supplier_credentials(last_login_status) 
    WHERE last_login_status IN ('failed', 'expired');

-- ============================================
-- SSRS INDEXES
-- ============================================

-- ssrs_scrape_runs indexes
CREATE INDEX idx_ssrs_scrape_runs_company ON ssrs_scrape_runs(company_id);

-- ssrs_store_products indexes
-- NOTE: idx_ssrs_store_products_company is NOT needed — the UNIQUE constraint
-- on (company_id, store_number, ean_plu, root_article_code) already covers it
CREATE INDEX idx_ssrs_store_products_run ON ssrs_store_products(run_id);
CREATE INDEX idx_ssrs_store_products_location ON ssrs_store_products(location_id);
CREATE INDEX idx_ssrs_store_products_store ON ssrs_store_products(store_number);
CREATE INDEX idx_ssrs_store_products_ean ON ssrs_store_products(ean_plu);
CREATE INDEX idx_ssrs_store_products_article ON ssrs_store_products(root_article_code);

-- ssrs_store_product_rows indexes (raw/staging table)
CREATE INDEX idx_ssrs_raw_rows_run ON ssrs_store_product_rows(run_id);
CREATE INDEX idx_ssrs_raw_rows_company ON ssrs_store_product_rows(company_id);

-- ============================================
-- OPTIMIZATION NOTES
-- ============================================
-- All indexes are now consolidated in this single file.
-- No indexes are created in table migrations.
--
-- These indexes will significantly improve query performance for:
-- - Dashboard loading (location-based queries)
-- - Date range filtering and reporting  
-- - Order workflow management
-- - Price comparison features
-- - Savings calculations and analytics
-- - Temporal price history queries
-- - Config settings lookups
-- - Credential management and scraper health monitoring
-- - SSRS scrape run lookups and store product queries
--
-- Index Types:
-- - UNIQUE: Enforce data integrity (supplier names)
-- - PARTIAL (WHERE clause): Smaller, faster indexes for specific query patterns
-- - COMPOSITE: Multi-column indexes for complex queries
-- - GIN: Full-text search on product descriptions
-- - BTREE (default): Standard indexes for equality/range queries

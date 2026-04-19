-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Mirrors the shared permission registry in @pricectrl/contracts/permissions.
-- Any RLS change here MUST be reflected in that registry and vice versa.
--
-- Role model:
--   master  — platform, unrestricted.
--   admin   — company owner. Reads own company + its locations + orders.
--             Edits only company_supplier_settings, location addresses, and
--             location_supplier_credentials for own company.
--   manager — single location. Reads own location. Sends orders for own
--             location. Edits own location_supplier_credentials.
--
-- JWT claims read (set by custom_access_token_hook):
--   user_role, company_id, location_id

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION is_master()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((auth.jwt()->>'user_role') = 'master', false);
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((auth.jwt()->>'user_role') = 'admin', false);
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_manager()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((auth.jwt()->>'user_role') = 'manager', false);
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT COALESCE((auth.jwt()->>'company_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_user_location_id()
RETURNS UUID AS $$
  SELECT COALESCE((auth.jwt()->>'location_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
$$ LANGUAGE SQL STABLE;

-- ============================================
-- BRANDS (platform catalog)
-- ============================================
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_brands" ON brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "master_insert_brands" ON brands FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_update_brands" ON brands FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "master_delete_brands" ON brands FOR DELETE TO authenticated USING (is_master());

-- ============================================
-- COMPANIES
-- ============================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_select_companies" ON companies FOR SELECT TO authenticated USING (is_master());

-- Admin + manager read their own company
CREATE POLICY "company_select_companies" ON companies FOR SELECT TO authenticated
  USING ((is_admin() OR is_manager()) AND id = get_user_company_id());

CREATE POLICY "master_insert_companies" ON companies FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_update_companies" ON companies FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "master_delete_companies" ON companies FOR DELETE TO authenticated USING (is_master());

-- ============================================
-- SUPPLIERS (platform catalog)
-- ============================================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "master_insert_suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_update_suppliers" ON suppliers FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "master_delete_suppliers" ON suppliers FOR DELETE TO authenticated USING (is_master());

-- ============================================
-- MASTER_PRODUCTS (platform catalog — writable by all roles, delete master-only)
-- ============================================
ALTER TABLE master_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_master_products" ON master_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_master_products" ON master_products FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update_master_products" ON master_products FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "master_delete_master_products" ON master_products FOR DELETE TO authenticated USING (is_master());

-- ============================================
-- SUPPLIER_PRODUCTS (platform catalog, master-only writes)
-- ============================================
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_supplier_products" ON supplier_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "master_insert_supplier_products" ON supplier_products FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_update_supplier_products" ON supplier_products FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "master_delete_supplier_products" ON supplier_products FOR DELETE TO authenticated USING (is_master());

-- ============================================
-- SUPPLIER_PRICE_HISTORY (platform, master-only writes)
-- ============================================
ALTER TABLE supplier_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_supplier_price_history" ON supplier_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "master_insert_supplier_price_history" ON supplier_price_history FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_update_supplier_price_history" ON supplier_price_history FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "master_delete_supplier_price_history" ON supplier_price_history FOR DELETE TO authenticated USING (is_master());

-- ============================================
-- LOCATIONS
-- ============================================
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Master reads all
CREATE POLICY "master_select_locations" ON locations FOR SELECT TO authenticated USING (is_master());

-- Admin reads all locations in own company
CREATE POLICY "admin_select_locations" ON locations FOR SELECT TO authenticated
  USING (is_admin() AND company_id = get_user_company_id());

-- Manager reads own location only
CREATE POLICY "manager_select_locations" ON locations FOR SELECT TO authenticated
  USING (is_manager() AND id = get_user_location_id());

-- Only master creates or deletes locations
CREATE POLICY "master_insert_locations" ON locations FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_delete_locations" ON locations FOR DELETE TO authenticated USING (is_master());

-- Master + admin update locations (admin bounded to own company).
-- Column-level restriction (admin edits only address/name) is enforced
-- by backend middleware; RLS is defence-in-depth.
CREATE POLICY "master_update_locations" ON locations FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "admin_update_locations" ON locations FOR UPDATE TO authenticated
  USING (is_admin() AND company_id = get_user_company_id());

-- ============================================
-- USER_PROFILES
-- ============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Every authenticated user can read their own profile row (needed by middleware).
CREATE POLICY "self_select_user_profiles" ON user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "master_select_user_profiles" ON user_profiles FOR SELECT TO authenticated USING (is_master());

-- Admin reads user_profiles within own company
CREATE POLICY "admin_select_user_profiles" ON user_profiles FOR SELECT TO authenticated
  USING (is_admin() AND company_id = get_user_company_id());

-- Only master creates / updates / deletes user_profiles
CREATE POLICY "master_insert_user_profiles" ON user_profiles FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_update_user_profiles" ON user_profiles FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "master_delete_user_profiles" ON user_profiles FOR DELETE TO authenticated USING (is_master());

-- ============================================
-- SUPPLIER_COMPANY_PRICES (company-scoped, master-only writes)
-- ============================================
ALTER TABLE supplier_company_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_select_supplier_company_prices" ON supplier_company_prices FOR SELECT TO authenticated USING (is_master());

CREATE POLICY "company_select_supplier_company_prices" ON supplier_company_prices FOR SELECT TO authenticated
  USING ((is_admin() OR is_manager()) AND company_id = get_user_company_id());

CREATE POLICY "master_insert_supplier_company_prices" ON supplier_company_prices FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_update_supplier_company_prices" ON supplier_company_prices FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "master_delete_supplier_company_prices" ON supplier_company_prices FOR DELETE TO authenticated USING (is_master());

-- ============================================
-- COMPANY_SUPPLIER_SETTINGS (thresholds etc. — admin editable)
-- ============================================
ALTER TABLE company_supplier_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_select_company_supplier_settings" ON company_supplier_settings FOR SELECT TO authenticated USING (is_master());
CREATE POLICY "master_insert_company_supplier_settings" ON company_supplier_settings FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_update_company_supplier_settings" ON company_supplier_settings FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "master_delete_company_supplier_settings" ON company_supplier_settings FOR DELETE TO authenticated USING (is_master());

CREATE POLICY "company_select_company_supplier_settings" ON company_supplier_settings FOR SELECT TO authenticated
  USING ((is_admin() OR is_manager()) AND company_id = get_user_company_id());

CREATE POLICY "admin_insert_company_supplier_settings" ON company_supplier_settings FOR INSERT TO authenticated
  WITH CHECK (is_admin() AND company_id = get_user_company_id());
CREATE POLICY "admin_update_company_supplier_settings" ON company_supplier_settings FOR UPDATE TO authenticated
  USING (is_admin() AND company_id = get_user_company_id());
CREATE POLICY "admin_delete_company_supplier_settings" ON company_supplier_settings FOR DELETE TO authenticated
  USING (is_admin() AND company_id = get_user_company_id());

-- ============================================
-- LOCATION_SUPPLIER_CREDENTIALS (admin CUD own co, manager CUD own loc)
-- ============================================
ALTER TABLE location_supplier_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_select_location_supplier_credentials" ON location_supplier_credentials FOR SELECT TO authenticated USING (is_master());
CREATE POLICY "master_insert_location_supplier_credentials" ON location_supplier_credentials FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_update_location_supplier_credentials" ON location_supplier_credentials FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "master_delete_location_supplier_credentials" ON location_supplier_credentials FOR DELETE TO authenticated USING (is_master());

CREATE POLICY "admin_select_location_supplier_credentials" ON location_supplier_credentials FOR SELECT TO authenticated
  USING (is_admin() AND company_id = get_user_company_id());
CREATE POLICY "admin_insert_location_supplier_credentials" ON location_supplier_credentials FOR INSERT TO authenticated
  WITH CHECK (is_admin() AND company_id = get_user_company_id());
CREATE POLICY "admin_update_location_supplier_credentials" ON location_supplier_credentials FOR UPDATE TO authenticated
  USING (is_admin() AND company_id = get_user_company_id());
CREATE POLICY "admin_delete_location_supplier_credentials" ON location_supplier_credentials FOR DELETE TO authenticated
  USING (is_admin() AND company_id = get_user_company_id());

CREATE POLICY "manager_select_location_supplier_credentials" ON location_supplier_credentials FOR SELECT TO authenticated
  USING (is_manager() AND company_id = get_user_company_id() AND location_id = get_user_location_id());
CREATE POLICY "manager_insert_location_supplier_credentials" ON location_supplier_credentials FOR INSERT TO authenticated
  WITH CHECK (is_manager() AND company_id = get_user_company_id() AND location_id = get_user_location_id());
CREATE POLICY "manager_update_location_supplier_credentials" ON location_supplier_credentials FOR UPDATE TO authenticated
  USING (is_manager() AND company_id = get_user_company_id() AND location_id = get_user_location_id());
CREATE POLICY "manager_delete_location_supplier_credentials" ON location_supplier_credentials FOR DELETE TO authenticated
  USING (is_manager() AND company_id = get_user_company_id() AND location_id = get_user_location_id());

-- ============================================
-- ORDERS
-- ============================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Master: full access (INSERT allowed but UI hides it)
CREATE POLICY "master_select_orders" ON orders FOR SELECT TO authenticated USING (is_master());
CREATE POLICY "master_insert_orders" ON orders FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_update_orders" ON orders FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "master_delete_orders" ON orders FOR DELETE TO authenticated USING (is_master());

-- Admin reads orders from own company (via location join)
CREATE POLICY "admin_select_orders" ON orders FOR SELECT TO authenticated
  USING (
    is_admin()
    AND EXISTS (
      SELECT 1 FROM locations
      WHERE locations.id = orders.location_id
      AND locations.company_id = get_user_company_id()
    )
  );

-- Manager reads + inserts orders for own location
CREATE POLICY "manager_select_orders" ON orders FOR SELECT TO authenticated
  USING (is_manager() AND location_id = get_user_location_id());

CREATE POLICY "manager_insert_orders" ON orders FOR INSERT TO authenticated
  WITH CHECK (is_manager() AND location_id = get_user_location_id());

-- ============================================
-- ORDER_ITEMS
-- ============================================
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_select_order_items" ON order_items FOR SELECT TO authenticated USING (is_master());
CREATE POLICY "master_insert_order_items" ON order_items FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_update_order_items" ON order_items FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "master_delete_order_items" ON order_items FOR DELETE TO authenticated USING (is_master());

CREATE POLICY "admin_select_order_items" ON order_items FOR SELECT TO authenticated
  USING (
    is_admin()
    AND EXISTS (
      SELECT 1 FROM orders
      JOIN locations ON locations.id = orders.location_id
      WHERE orders.id = order_items.order_id
      AND locations.company_id = get_user_company_id()
    )
  );

CREATE POLICY "manager_select_order_items" ON order_items FOR SELECT TO authenticated
  USING (
    is_manager()
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.location_id = get_user_location_id()
    )
  );

CREATE POLICY "manager_insert_order_items" ON order_items FOR INSERT TO authenticated
  WITH CHECK (
    is_manager()
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.location_id = get_user_location_id()
    )
  );

-- ============================================
-- SAVINGS_CALCULATIONS (read-only for admin/manager within own company)
-- ============================================
ALTER TABLE savings_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_select_savings_calculations" ON savings_calculations FOR SELECT TO authenticated USING (is_master());
CREATE POLICY "master_insert_savings_calculations" ON savings_calculations FOR INSERT TO authenticated WITH CHECK (is_master());
CREATE POLICY "master_update_savings_calculations" ON savings_calculations FOR UPDATE TO authenticated USING (is_master());
CREATE POLICY "master_delete_savings_calculations" ON savings_calculations FOR DELETE TO authenticated USING (is_master());

CREATE POLICY "company_select_savings_calculations" ON savings_calculations FOR SELECT TO authenticated
  USING ((is_admin() OR is_manager()) AND company_id = get_user_company_id());

-- ============================================
-- SSRS_SCRAPE_RUNS
-- ============================================
ALTER TABLE ssrs_scrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_all_ssrs_scrape_runs" ON ssrs_scrape_runs
    FOR ALL TO authenticated USING (is_master());

CREATE POLICY "company_select_ssrs_scrape_runs" ON ssrs_scrape_runs
    FOR SELECT TO authenticated
    USING ((is_admin() OR is_manager()) AND company_id = get_user_company_id());

-- ============================================
-- SSRS_STORE_PRODUCTS
-- ============================================
ALTER TABLE ssrs_store_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_all_ssrs_store_products" ON ssrs_store_products
    FOR ALL TO authenticated USING (is_master());

CREATE POLICY "company_select_ssrs_store_products" ON ssrs_store_products
    FOR SELECT TO authenticated
    USING ((is_admin() OR is_manager()) AND company_id = get_user_company_id());

-- ============================================
-- SSRS_STORE_PRODUCT_ROWS
-- ============================================
ALTER TABLE ssrs_store_product_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_all_ssrs_store_product_rows" ON ssrs_store_product_rows
    FOR ALL TO authenticated USING (is_master());

CREATE POLICY "company_select_ssrs_store_product_rows" ON ssrs_store_product_rows
    FOR SELECT TO authenticated
    USING ((is_admin() OR is_manager()) AND company_id = get_user_company_id());

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION is_master IS 'Returns true if authenticated user has master role';
COMMENT ON FUNCTION is_admin IS 'Returns true if authenticated user has admin role';
COMMENT ON FUNCTION is_manager IS 'Returns true if authenticated user has manager role';
COMMENT ON FUNCTION get_user_company_id IS 'Returns company_id from JWT claims';
COMMENT ON FUNCTION get_user_location_id IS 'Returns location_id from JWT claims';

-- ============================================
-- LOCK DOWN ANON ROLE
-- ============================================
-- All frontend CRUD now routes through the Express backend, which talks
-- to Postgres as service_role (or under the user JWT as `authenticated`,
-- still gated by the RLS policies above). The `anon` role must not be
-- able to read or mutate any application table directly.
--
-- `authenticated` grants are retained on purpose: the backend issues
-- user-scoped clients so RLS stays as the second line of defense behind
-- the requirePermission middleware. A logged-in client that tries to
-- bypass the backend hits the same RLS policies it would via the API.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

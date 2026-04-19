-- ============================================
-- LOCATION SUPPLIER CREDENTIALS TABLE
-- ============================================
-- Stores login credentials for supplier websites per location/store
-- Used by scraper to fetch prices from supplier portals
-- Passwords stored using Supabase Vault for security

CREATE TABLE location_supplier_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Location owns the credentials (each store has own login)
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    
    -- Denormalized company_id for efficient RLS (best practice for multi-tenant)
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Credentials (password stored in Supabase Vault)
    username TEXT NOT NULL,
    password_secret_id UUID NOT NULL,  -- References vault.secrets
    
    -- Supplier website info
    website_url TEXT,
    login_url TEXT,
    
    -- Status tracking for scraper health monitoring
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    last_login_status TEXT CHECK (last_login_status IN ('success', 'failed', 'expired', 'pending')),
    last_error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One credential set per location-supplier combination
    UNIQUE(location_id, supplier_id)
);

COMMENT ON TABLE location_supplier_credentials IS 
    'Login credentials for supplier websites per store location';
COMMENT ON COLUMN location_supplier_credentials.company_id IS 
    'Denormalized company_id for fast RLS tenant isolation';
COMMENT ON COLUMN location_supplier_credentials.password_secret_id IS 
    'Reference to encrypted password in vault.secrets';
COMMENT ON COLUMN location_supplier_credentials.last_login_status IS 
    'Status of last scraper login attempt';

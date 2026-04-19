-- 1. Companies (Multi-tenancy foundation)
DROP TABLE IF EXISTS companies CASCADE;
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    phone TEXT CHECK (phone ~ '^\+353\s[0-9]{1,2}\s[0-9]{3}\s[0-9]{4}$'),
    brand_id UUID REFERENCES brands(id),
    subscription_tier TEXT DEFAULT 'essential' CHECK (subscription_tier IN ('essential', 'advanced', 'custom')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

COMMENT ON COLUMN companies.brand_id IS 'Reference to the brand this company operates under';

-- NOTE: Company addresses are stored in the dedicated 'addresses' table
-- with company_id foreign key reference

--TODO: Add the main contact responsable for the account

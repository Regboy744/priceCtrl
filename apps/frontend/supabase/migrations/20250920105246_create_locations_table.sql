-- 4. Locations (depends on: companies)
DROP TABLE IF EXISTS locations CASCADE;
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location_number INTEGER NOT NULL CHECK (location_number >= 1 AND location_number <= 999999),
    location_type TEXT NOT NULL CHECK (location_type IN ('store', 'office')),
    manager_id UUID, -- Will be populated later on the step 5
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(company_id, location_number)
);

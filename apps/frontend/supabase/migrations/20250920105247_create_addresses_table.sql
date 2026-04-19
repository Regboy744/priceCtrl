-- Depends on: companies, locations

CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Explicit foreign keys (only ONE should be set)
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,

    -- Address fields
    street_address TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    county TEXT NOT NULL,
    eircode TEXT,
    country TEXT NOT NULL DEFAULT 'Ireland',

    -- Address type: 'primary', 'billing', 'shipping', 'warehouse'
    address_type TEXT NOT NULL DEFAULT 'primary',

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: exactly ONE FK must be set
    CHECK (
        (company_id IS NOT NULL AND location_id IS NULL) OR
        (company_id IS NULL AND location_id IS NOT NULL)
    ),

    -- Unique constraints per entity
    UNIQUE(company_id, address_type),
    UNIQUE(location_id, address_type)
);

-- TODO: Add the eircode mask validation on the migration

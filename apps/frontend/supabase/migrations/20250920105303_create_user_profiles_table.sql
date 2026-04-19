-- 5. User Profiles (depends on:users,  companies and locations)

DROP TABLE IF EXISTS user_profiles CASCADE;
-- TRUNCATE auth.users CASCADE;

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('master', 'admin', 'manager' )),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    theme_mode TEXT DEFAULT 'light' NOT NULL,
    avatar_url TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- IMPORTANT: Adding manager constraint AFTER user_profiles creation
-- WHY: This solves a circular dependency problem:
-- - locations.manager_id needs to reference user_profiles.id
-- - user_profiles.location_id needs to reference locations.id
-- SOLUTION: Create locations first (without manager constraint), 
--           then user_profiles, then add the manager constraint
-- NOTE: Keep this in the SAME migration as user_profiles creation
--       to prevent data inconsistency between migrations
ALTER TABLE locations 
ADD CONSTRAINT fk_locations_manager 
FOREIGN KEY (manager_id) REFERENCES user_profiles(id);

-- ============================================
-- AUTH HOOK: Add user_role, company_id, and location_id to JWT
-- ============================================
-- This hook adds custom claims to the JWT token so RLS policies
-- can check the user's business role, company, and location affiliation

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
  company_id uuid;
  location_id uuid;
BEGIN
  -- Fetch user role, company_id, and location_id from user_profiles
  SELECT role, user_profiles.company_id, user_profiles.location_id 
  INTO user_role, company_id, location_id
  FROM public.user_profiles
  WHERE id = (event->>'user_id')::uuid;

  -- Ensure claims object exists before setting nested keys
  IF event->'claims' IS NULL THEN
    event := jsonb_set(event, '{claims}', '{}'::jsonb);
  END IF;

  -- Add custom claims to JWT (must be under event.claims per Supabase spec)
  IF user_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,user_role}', to_jsonb(user_role));
  END IF;

  IF company_id IS NOT NULL THEN
    event := jsonb_set(event, '{claims,company_id}', to_jsonb(company_id::text));
  END IF;

  IF location_id IS NOT NULL THEN
    event := jsonb_set(event, '{claims,location_id}', to_jsonb(location_id::text));
  END IF;

  RETURN event;
END;
$$;

-- Grant necessary permissions to Supabase auth system
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO service_role;

-- Reduce attack surface: only auth admin + service role may call this
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, PUBLIC;

COMMENT ON FUNCTION public.custom_access_token_hook IS 'Adds user_role, company_id, and location_id to JWT claims for RLS policies';

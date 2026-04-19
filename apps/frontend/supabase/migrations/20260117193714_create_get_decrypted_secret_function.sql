-- ============================================
-- GET DECRYPTED SECRET FUNCTION
-- ============================================
-- Securely retrieves decrypted secrets from Supabase Vault
-- Uses SECURITY DEFINER to run with elevated privileges
-- Only accessible by service_role (backend)

CREATE OR REPLACE FUNCTION public.get_decrypted_secret(secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  decrypted_value TEXT;
BEGIN
  -- Query the vault.decrypted_secrets view
  SELECT decrypted_secret INTO decrypted_value
  FROM vault.decrypted_secrets
  WHERE id = secret_id;
  
  IF decrypted_value IS NULL THEN
    RAISE EXCEPTION 'Secret not found: %', secret_id;
  END IF;
  
  RETURN decrypted_value;
END;
$$;

-- Security: Revoke public access and grant only to service_role
REVOKE ALL ON FUNCTION public.get_decrypted_secret(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_decrypted_secret(UUID) TO service_role;

-- Comment for documentation
COMMENT ON FUNCTION public.get_decrypted_secret IS 'Securely retrieves decrypted secret from Vault. Only accessible by service_role.';

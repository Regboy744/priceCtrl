-- ============================================
-- GET DECRYPTED SECRETS (BATCH) FUNCTION
-- ============================================
-- Batched counterpart to get_decrypted_secret(UUID).
--
-- Motivation: vaultService.getCredentialCandidatesForCompany /
-- getAllCredentialsForSupplier decrypt N secrets with Promise.all over N
-- separate RPCs. For large credential sets this serializes N PostgREST round
-- trips. This batched variant returns the set in a single call.
--
-- SECURITY DEFINER + service_role-only, same guardrail as the single variant.

CREATE OR REPLACE FUNCTION public.get_decrypted_secrets(secret_ids UUID[])
RETURNS TABLE (id UUID, decrypted_secret TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  RETURN QUERY
  SELECT ds.id, ds.decrypted_secret
  FROM vault.decrypted_secrets AS ds
  WHERE ds.id = ANY(secret_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_decrypted_secrets(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_decrypted_secrets(UUID[]) TO service_role;

COMMENT ON FUNCTION public.get_decrypted_secrets IS 'Batch variant of get_decrypted_secret. service_role only.';

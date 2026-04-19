-- ============================================
-- LOCATION CREDENTIAL RPC FUNCTIONS
-- ============================================
-- Secure functions to manage supplier credentials with Vault integration
-- Passwords are stored encrypted in vault.secrets

-- ============================================
-- CREATE CREDENTIAL FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.create_location_credential(
    p_location_id UUID,
    p_company_id UUID,
    p_supplier_id UUID,
    p_username TEXT,
    p_password TEXT,
    p_website_url TEXT DEFAULT NULL,
    p_login_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_user_company_id UUID;
    v_location_company_id UUID;
    v_secret_id UUID;
    v_credential_id UUID;
BEGIN
    -- Validate user belongs to the company (RLS check)
    -- TODO: Re-enable auth check before production
    -- SELECT get_user_company_id() INTO v_user_company_id;
    -- 
    -- IF v_user_company_id IS NULL OR v_user_company_id != p_company_id THEN
    --     RAISE EXCEPTION 'Access denied: User does not belong to this company';
    -- END IF;
    v_user_company_id := p_company_id; -- DEV BYPASS: Trust passed company_id
    
    -- Validate location belongs to the company
    SELECT company_id INTO v_location_company_id
    FROM locations
    WHERE id = p_location_id;
    
    IF v_location_company_id IS NULL THEN
        RAISE EXCEPTION 'Location not found';
    END IF;
    
    IF v_location_company_id != p_company_id THEN
        RAISE EXCEPTION 'Access denied: Location does not belong to this company';
    END IF;
    
    -- Check if credential already exists for this location-supplier combo
    IF EXISTS (
        SELECT 1 FROM location_supplier_credentials 
        WHERE location_id = p_location_id AND supplier_id = p_supplier_id
    ) THEN
        RAISE EXCEPTION 'Credential already exists for this location and supplier';
    END IF;
    
    -- Store password in vault
    SELECT vault.create_secret(
        p_password,
        'credential_' || gen_random_uuid()::text,
        'Password for supplier credential'
    ) INTO v_secret_id;
    
    -- Insert credential record
    INSERT INTO location_supplier_credentials (
        location_id,
        company_id,
        supplier_id,
        username,
        password_secret_id,
        website_url,
        login_url,
        is_active
    )
    VALUES (
        p_location_id,
        p_company_id,
        p_supplier_id,
        p_username,
        v_secret_id,
        p_website_url,
        p_login_url,
        TRUE
    )
    RETURNING id INTO v_credential_id;
    
    RETURN v_credential_id;
END;
$$;

-- ============================================
-- UPDATE CREDENTIAL FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.update_location_credential(
    p_credential_id UUID,
    p_username TEXT,
    p_password TEXT DEFAULT NULL,
    p_website_url TEXT DEFAULT NULL,
    p_login_url TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_user_company_id UUID;
    v_credential_company_id UUID;
    v_secret_id UUID;
BEGIN
    -- Get user's company
    -- TODO: Re-enable auth check before production
    -- SELECT get_user_company_id() INTO v_user_company_id;
    
    -- Get credential's company and secret_id
    SELECT company_id, password_secret_id 
    INTO v_credential_company_id, v_secret_id
    FROM location_supplier_credentials
    WHERE id = p_credential_id;
    
    IF v_credential_company_id IS NULL THEN
        RAISE EXCEPTION 'Credential not found';
    END IF;
    
    -- RLS check: user must belong to the same company
    -- TODO: Re-enable auth check before production
    -- IF v_user_company_id IS NULL OR v_user_company_id != v_credential_company_id THEN
    --     RAISE EXCEPTION 'Access denied: User does not have permission to update this credential';
    -- END IF;
    v_user_company_id := v_credential_company_id; -- DEV BYPASS
    
    -- Update password in vault if provided
    IF p_password IS NOT NULL AND p_password != '' THEN
        PERFORM vault.update_secret(
            v_secret_id,
            p_password,
            NULL,  -- keep existing name
            NULL   -- keep existing description
        );
    END IF;
    
    -- Update credential record
    UPDATE location_supplier_credentials
    SET
        username = p_username,
        website_url = p_website_url,
        login_url = p_login_url,
        is_active = p_is_active,
        updated_at = NOW()
    WHERE id = p_credential_id;
END;
$$;

-- ============================================
-- DELETE CREDENTIAL FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.delete_location_credential(
    p_credential_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_user_company_id UUID;
    v_credential_company_id UUID;
    v_secret_id UUID;
BEGIN
    -- Get user's company
    -- TODO: Re-enable auth check before production
    -- SELECT get_user_company_id() INTO v_user_company_id;
    
    -- Get credential's company and secret_id
    SELECT company_id, password_secret_id 
    INTO v_credential_company_id, v_secret_id
    FROM location_supplier_credentials
    WHERE id = p_credential_id;
    
    IF v_credential_company_id IS NULL THEN
        RAISE EXCEPTION 'Credential not found';
    END IF;
    
    -- RLS check: user must belong to the same company
    -- TODO: Re-enable auth check before production
    -- IF v_user_company_id IS NULL OR v_user_company_id != v_credential_company_id THEN
    --     RAISE EXCEPTION 'Access denied: User does not have permission to delete this credential';
    -- END IF;
    v_user_company_id := v_credential_company_id; -- DEV BYPASS
    
    -- Delete the vault secret
    DELETE FROM vault.secrets WHERE id = v_secret_id;
    
    -- Delete credential record
    DELETE FROM location_supplier_credentials WHERE id = p_credential_id;
END;
$$;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION public.create_location_credential(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_location_credential(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_location_credential(UUID) TO authenticated;

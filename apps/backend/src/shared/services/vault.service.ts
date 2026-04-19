import { getServiceClient } from '../database/supabase.js';
import { NotFoundError, ServiceUnavailableError } from '../errors/AppError.js';
import type { Tables } from '../types/database.types.js';
import { createLogger } from './logger.service.js';

const log = createLogger('VaultService');

type LocationSupplierCredentials = Tables<'location_supplier_credentials'>;

type CredentialPriority = Pick<
  LocationSupplierCredentials,
  'id' | 'last_login_status' | 'last_login_at' | 'updated_at'
>;

const getStatusRank = (status: string | null): number => (status === 'success' ? 0 : 1);

const getTimestamp = (value: string | null): number => (value ? Date.parse(value) : 0);

const compareCredentialPriority = (a: CredentialPriority, b: CredentialPriority): number => {
  const statusDiff = getStatusRank(a.last_login_status) - getStatusRank(b.last_login_status);
  if (statusDiff !== 0) return statusDiff;

  const lastLoginDiff = getTimestamp(b.last_login_at) - getTimestamp(a.last_login_at);
  if (lastLoginDiff !== 0) return lastLoginDiff;

  const updatedDiff = getTimestamp(b.updated_at) - getTimestamp(a.updated_at);
  if (updatedDiff !== 0) return updatedDiff;

  return a.id.localeCompare(b.id);
};

const sortCredentialRows = <T extends CredentialPriority>(rows: T[]): T[] =>
  [...rows].sort(compareCredentialPriority);

export interface SupplierCredentials {
  id: string;
  supplierId: string;
  locationId: string;
  companyId: string;
  username: string;
  password: string;
  websiteUrl: string | null;
  loginUrl: string | null;
}

/**
 * Service for securely retrieving credentials from Supabase Vault.
 */
export class VaultService {
  private supabase = getServiceClient();

  /**
   * Retrieve decrypted password from Supabase Vault.
   * @param secretId - The UUID of the secret in vault.secrets
   */
  async getSecret(secretId: string): Promise<string> {
    const { data, error } = await this.supabase.rpc(
      'get_decrypted_secret' as never,
      {
        secret_id: secretId,
      } as never
    );

    if (error) {
      // Previously this catch block swallowed the real error and raised a
      // generic "Vault access not configured" message, which hid RLS denials,
      // missing secrets, and rotation issues. Log the actual Postgres error
      // and surface a 503 so on-call sees the root cause.
      log.error({ err: error, secretId }, 'get_decrypted_secret RPC failed');
      throw new ServiceUnavailableError(
        `Failed to decrypt secret: ${error.message}`,
        'VAULT_DECRYPT_FAILED'
      );
    }

    if (!data) {
      throw new NotFoundError(`Secret ${secretId} not found`);
    }

    return data as string;
  }

  /**
   * Batch decrypt. Single RPC round-trip instead of one per secret. Returns a
   * Map keyed by secretId so callers can reassemble per-row. Missing ids are
   * omitted from the map — callers decide whether that is fatal.
   */
  async getSecrets(secretIds: string[]): Promise<Map<string, string>> {
    if (secretIds.length === 0) return new Map();

    const { data, error } = await this.supabase.rpc(
      'get_decrypted_secrets' as never,
      { secret_ids: secretIds } as never
    );

    if (error) {
      log.error({ err: error, count: secretIds.length }, 'get_decrypted_secrets RPC failed');
      throw new ServiceUnavailableError(
        `Failed to batch decrypt secrets: ${error.message}`,
        'VAULT_DECRYPT_FAILED'
      );
    }

    const out = new Map<string, string>();
    for (const row of (data ?? []) as Array<{ id: string; decrypted_secret: string }>) {
      if (row.decrypted_secret) out.set(row.id, row.decrypted_secret);
    }
    return out;
  }

  /**
   * Get full credentials for a supplier at a specific location.
   * Includes decrypted password from Vault.
   */
  async getCredentialsForLocation(
    locationId: string,
    supplierId: string
  ): Promise<SupplierCredentials> {
    // Fetch credential record
    const { data, error } = await this.supabase
      .from('location_supplier_credentials')
      .select('*')
      .eq('location_id', locationId)
      .eq('supplier_id', supplierId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new NotFoundError(
        `No credentials found for supplier ${supplierId} at location ${locationId}`
      );
    }

    const credentials = data as LocationSupplierCredentials;

    // Decrypt password from vault
    const password = await this.getSecret(credentials.password_secret_id);

    return {
      id: credentials.id,
      supplierId: credentials.supplier_id,
      locationId: credentials.location_id,
      companyId: credentials.company_id,
      username: credentials.username,
      password,
      websiteUrl: credentials.website_url,
      loginUrl: credentials.login_url,
    };
  }

  /**
   * Get the best credential for a supplier at a company.
   * Uses priority: last success → most recent login → most recently updated.
   */
  async getCredentialsForCompany(
    companyId: string,
    supplierId: string
  ): Promise<SupplierCredentials> {
    const candidates = await this.getCredentialCandidatesForCompany(companyId, supplierId);
    return candidates[0];
  }

  /**
   * Get all credential candidates for a supplier at a company, ordered by priority.
   */
  async getCredentialCandidatesForCompany(
    companyId: string,
    supplierId: string
  ): Promise<SupplierCredentials[]> {
    const { data, error } = await this.supabase
      .from('location_supplier_credentials')
      .select('*')
      .eq('company_id', companyId)
      .eq('supplier_id', supplierId)
      .eq('is_active', true);

    if (error || !data || data.length === 0) {
      throw new NotFoundError(
        `No credentials found for supplier ${supplierId} at company ${companyId}`
      );
    }

    const sorted = sortCredentialRows(data as LocationSupplierCredentials[]);
    const secrets = await this.getSecrets(sorted.map((c) => c.password_secret_id));

    return sorted.map((cred) => ({
      id: cred.id,
      supplierId: cred.supplier_id,
      locationId: cred.location_id,
      companyId: cred.company_id,
      username: cred.username,
      password: secrets.get(cred.password_secret_id) ?? '',
      websiteUrl: cred.website_url,
      loginUrl: cred.login_url,
    }));
  }

  /**
   * Get the best credential per company for a supplier.
   * Returns one credential per company, ordered by priority.
   */
  async getBestCredentialsByCompanyForSupplier(
    supplierId: string
  ): Promise<LocationSupplierCredentials[]> {
    const { data, error } = await this.supabase
      .from('location_supplier_credentials')
      .select('*')
      .eq('supplier_id', supplierId)
      .eq('is_active', true);

    if (error) {
      log.error({ err: error }, 'Failed to fetch credentials');
      throw new ServiceUnavailableError('Failed to fetch credentials');
    }

    if (!data || data.length === 0) {
      return [];
    }

    const bestByCompany = new Map<string, LocationSupplierCredentials>();

    for (const row of data as LocationSupplierCredentials[]) {
      const existing = bestByCompany.get(row.company_id);
      if (!existing || compareCredentialPriority(row, existing) < 0) {
        bestByCompany.set(row.company_id, row);
      }
    }

    return sortCredentialRows(Array.from(bestByCompany.values()));
  }

  /**
   * Get all credentials for a specific supplier across all locations.
   * Useful for batch scraping operations.
   */
  async getAllCredentialsForSupplier(supplierId: string): Promise<SupplierCredentials[]> {
    const { data, error } = await this.supabase
      .from('location_supplier_credentials')
      .select('*')
      .eq('supplier_id', supplierId)
      .eq('is_active', true);

    if (error) {
      log.error({ err: error }, 'Failed to fetch credentials');
      throw new ServiceUnavailableError('Failed to fetch credentials');
    }

    if (!data || data.length === 0) {
      return [];
    }

    const rows = data as LocationSupplierCredentials[];
    const secrets = await this.getSecrets(rows.map((c) => c.password_secret_id));

    return rows.map((cred) => ({
      id: cred.id,
      supplierId: cred.supplier_id,
      locationId: cred.location_id,
      companyId: cred.company_id,
      username: cred.username,
      password: secrets.get(cred.password_secret_id) ?? '',
      websiteUrl: cred.website_url,
      loginUrl: cred.login_url,
    }));
  }

  /**
   * Update the login status for a credential record.
   * Call this after scraping attempts to track success/failure.
   */
  async updateLoginStatus(
    credentialId: string,
    status: 'success' | 'failed' | 'expired',
    errorMessage?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('location_supplier_credentials')
      .update({
        last_login_at: new Date().toISOString(),
        last_login_status: status,
        last_error_message: errorMessage ?? null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', credentialId);

    if (error) {
      log.error({ err: error, credentialId }, 'Failed to update login status');
      // Intentionally not thrown. This is telemetry called from the success
      // / failure branch of a scrape or credential test — we do not want a
      // status-write failure to mask the real outcome or bubble up into the
      // response. Monitor the log channel if updates stop appearing.
    }
  }
}

// Singleton instance
export const vaultService = new VaultService();

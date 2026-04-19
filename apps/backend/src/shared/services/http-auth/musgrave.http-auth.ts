/**
 * Musgrave HTTP login adapter.
 *
 * Wraps the existing OAuth2 password-grant login (`musgrave.api.httpLogin`)
 * in the shared `HttpAuthSession` shape so ordering handlers can consume it
 * without supplier-specific branching.
 *
 * Musgrave uses a header-based auth token rather than cookies — both are
 * exposed via `metadata.apiToken` / `metadata.pgId`. `cookies` is left empty.
 */

import { httpLogin as musgraveHttpLogin } from '../../../features/suppliers/musgrave/musgrave.api.js';
import type { MusgraveAuthTokens } from '../../../features/suppliers/musgrave/musgrave.types.js';
import type { SupplierCredentials } from '../vault.service.js';
import type { HttpAuthSession } from './http-auth.types.js';

export interface MusgraveAuthMetadata extends Record<string, unknown> {
  apiToken: string;
  pgId: string;
}

export async function loginMusgrave(credentials: SupplierCredentials): Promise<HttpAuthSession> {
  const tokens: MusgraveAuthTokens = await musgraveHttpLogin(
    credentials.username,
    credentials.password
  );

  const metadata: MusgraveAuthMetadata = {
    apiToken: tokens.apiToken,
    pgId: tokens.pgId,
  };

  return {
    cookies: '',
    metadata,
  };
}

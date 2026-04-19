/**
 * Shared types for HTTP-based supplier authentication.
 *
 * One unified shape so both scrapers and ordering handlers can consume the
 * result of any supplier login without per-supplier branching.
 */

/**
 * Outcome of a successful HTTP login.
 *
 * `cookies` is the cookie string ("name=value; name2=value2") to send on
 * subsequent authenticated requests.
 *
 * `metadata` carries supplier-specific auth context that is not a cookie —
 * e.g. Musgrave's `apiToken` and `pgId` returned by OAuth2.
 */
export interface HttpAuthSession {
  cookies: string;
  metadata?: Record<string, unknown>;
}

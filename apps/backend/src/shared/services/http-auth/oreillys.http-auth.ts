/**
 * O'Reillys HTTP login (no browser).
 *
 * Flow:
 *   1. GET /mainlogin.asp → collect ASP session + Cloudflare cookies
 *   2. POST /login.asp with username & password + cookies from step 1
 *   3. Response sets authenticated session cookie → returned for reuse
 */

import { curlService } from '../curl.service.js';
import { createLogger } from '../logger.service.js';
import type { SupplierCredentials } from '../vault.service.js';
import { extractCookieString, mergeCookies } from './cookie.util.js';
import type { HttpAuthSession } from './http-auth.types.js';

const log = createLogger('OreillysHttpAuth');

const BASE_URL = 'https://order.oreillyswholesale.com';
const LOGIN_URL = `${BASE_URL}/mainlogin.asp`;
const LOGIN_ENDPOINT = `${BASE_URL}/login.asp`;

const HTML_ACCEPT_HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

export async function loginOreillys(credentials: SupplierCredentials): Promise<HttpAuthSession> {
  log.info('Logging in via HTTP POST');

  const loginPageRes = await curlService.fetch(LOGIN_URL, {
    captureHeaders: true,
    headers: HTML_ACCEPT_HEADERS,
  });

  if (loginPageRes.statusCode !== 200) {
    throw new Error(`Failed to load login page: HTTP ${loginPageRes.statusCode}`);
  }

  const initialCookies = extractCookieString(loginPageRes.setCookies ?? []);

  const postBody = `username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}`;

  const loginRes = await curlService.fetch(LOGIN_ENDPOINT, {
    method: 'POST',
    body: postBody,
    cookies: initialCookies,
    captureHeaders: true,
    headers: {
      ...HTML_ACCEPT_HEADERS,
      'content-type': 'application/x-www-form-urlencoded',
      referer: LOGIN_URL,
    },
  });

  const postCookies = extractCookieString(loginRes.setCookies ?? []);
  const cookies = mergeCookies(initialCookies, postCookies);

  // Failure surface: the response body re-renders the login form with a
  // human-readable error rather than redirecting elsewhere.
  const body = loginRes.body.toLowerCase();
  if (body.includes('invalid details') || body.includes('re-enter')) {
    throw new Error('Login failed — invalid credentials');
  }

  log.info('HTTP login successful');
  return { cookies };
}

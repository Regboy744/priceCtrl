/**
 * Barry Group HTTP login (no browser).
 *
 * Flow:
 *   1. GET / → collect ASP session + Cloudflare cookies
 *   2. POST /login.asp with credentials, do NOT follow the 302 — the redirect
 *      response itself sets the authenticated session cookie and the Location
 *      body tells us success vs failure (`invalid=1` query param means failure).
 */

import { curlService } from '../curl.service.js';
import { createLogger } from '../logger.service.js';
import type { SupplierCredentials } from '../vault.service.js';
import { extractCookieString, mergeCookies } from './cookie.util.js';
import type { HttpAuthSession } from './http-auth.types.js';

const log = createLogger('BarryGroupHttpAuth');

const BASE_URL = 'https://ind.barrys.ie';
const LOGIN_URL = `${BASE_URL}/`;
const LOGIN_ENDPOINT = `${BASE_URL}/login.asp`;

/**
 * URLs visited after a successful login to establish session state the rest
 * of the site relies on. Mirrors the old Puppeteer auth's `afterLoginUrls`.
 *
 * SetDetails?Dept=6 selects the Ambient department server-side. Without it,
 * AddLine.asp will silently reject every item with QtyInBasket=0.
 */
const POST_LOGIN_URLS = [`${BASE_URL}/products/SetDetails.asp?Dept=6`];

const HTML_ACCEPT_HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

const SUPPLIER_KEY = 'Barry Group';

export async function loginBarryGroup(
  credentials: SupplierCredentials,
  options?: { jobId?: string }
): Promise<HttpAuthSession> {
  log.info('Logging in via HTTP POST');
  const { jobId } = options ?? {};

  const loginPageRes = await curlService.fetch(LOGIN_URL, {
    captureHeaders: true,
    headers: HTML_ACCEPT_HEADERS,
    supplierKey: SUPPLIER_KEY,
    jobId,
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
    followRedirects: false,
    headers: {
      ...HTML_ACCEPT_HEADERS,
      'content-type': 'application/x-www-form-urlencoded',
      referer: LOGIN_URL,
    },
    supplierKey: SUPPLIER_KEY,
    jobId,
  });

  // 302 → /default.asp = success; 302 → /default.asp?invalid=1 = bad creds
  if (loginRes.statusCode === 302 || loginRes.statusCode === 301) {
    if (loginRes.body.includes('invalid=1') || loginRes.body.includes('invalid%3D1')) {
      throw new Error('Login failed — invalid credentials');
    }
  } else if (loginRes.statusCode !== 200) {
    throw new Error(`Login failed — unexpected status ${loginRes.statusCode}`);
  }

  const postCookies = extractCookieString(loginRes.setCookies ?? []);
  let cookies = mergeCookies(initialCookies, postCookies);

  if (!cookies) {
    throw new Error('Login failed — no session cookies received');
  }

  // Visit post-login URLs to set server-side session state (selected
  // department). Required for AddLine.asp + product list pages to work.
  for (const url of POST_LOGIN_URLS) {
    const res = await curlService.fetch(url, {
      cookies,
      captureHeaders: true,
      headers: {
        ...HTML_ACCEPT_HEADERS,
        referer: LOGIN_URL,
      },
      supplierKey: SUPPLIER_KEY,
      jobId,
    });
    cookies = mergeCookies(cookies, extractCookieString(res.setCookies ?? []));
  }

  log.info('HTTP login successful');
  return { cookies };
}

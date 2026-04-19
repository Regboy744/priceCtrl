/**
 * Savage & Whitten HTTP login (no browser).
 *
 * Umbraco CMS with AJAX login:
 *   1. GET /login → cookies + __RequestVerificationToken (CSRF, hidden input)
 *   2. POST /umbraco/surface/UmbracoLogin/HandleLogin
 *      Body: __RequestVerificationToken + Username + Password (form-encoded)
 *      Response: JSON { success: true, redirectUrl: "..." }
 */

import * as cheerio from 'cheerio';
import { curlService } from '../curl.service.js';
import { createLogger } from '../logger.service.js';
import type { SupplierCredentials } from '../vault.service.js';
import { extractCookieString, mergeCookies } from './cookie.util.js';
import type { HttpAuthSession } from './http-auth.types.js';

const log = createLogger('SavageWhittenHttpAuth');

const BASE_URL = 'https://www.savageandwhitten.com';
const LOGIN_URL = `${BASE_URL}/login`;
const LOGIN_ENDPOINT = `${BASE_URL}/umbraco/surface/UmbracoLogin/HandleLogin`;

export async function loginSavageWhitten(
  credentials: SupplierCredentials
): Promise<HttpAuthSession> {
  log.info('Logging in via HTTP POST');

  const loginPageRes = await curlService.fetch(LOGIN_URL, {
    captureHeaders: true,
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    },
  });

  if (loginPageRes.statusCode !== 200) {
    throw new Error(`Failed to load login page: HTTP ${loginPageRes.statusCode}`);
  }

  const $ = cheerio.load(loginPageRes.body);
  const csrfToken = $('input[name="__RequestVerificationToken"]').val() as string;
  if (!csrfToken) {
    throw new Error('Login failed — CSRF token not found on login page');
  }

  const initialCookies = extractCookieString(loginPageRes.setCookies ?? []);

  const postBody = [
    `__RequestVerificationToken=${encodeURIComponent(csrfToken)}`,
    `Username=${encodeURIComponent(credentials.username)}`,
    `Password=${encodeURIComponent(credentials.password)}`,
  ].join('&');

  const loginRes = await curlService.fetch(LOGIN_ENDPOINT, {
    method: 'POST',
    body: postBody,
    cookies: initialCookies,
    captureHeaders: true,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
      referer: LOGIN_URL,
    },
  });

  const postCookies = extractCookieString(loginRes.setCookies ?? []);
  const cookies = mergeCookies(initialCookies, postCookies);

  let result: { success?: boolean; redirectUrl?: string };
  try {
    result = JSON.parse(loginRes.body);
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error('Login failed — unexpected response (not JSON)');
    }
    throw e;
  }

  if (!result.success) {
    throw new Error('Login failed — server returned success: false');
  }

  log.info({ redirectUrl: result.redirectUrl }, 'HTTP login successful');
  return { cookies };
}

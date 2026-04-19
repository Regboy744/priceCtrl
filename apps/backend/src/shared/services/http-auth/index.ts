/**
 * HTTP-based supplier authentication.
 *
 * Per-supplier login modules return a unified `HttpAuthSession` so both
 * scrapers and ordering handlers can authenticate via the same code path,
 * with no Puppeteer involved.
 */

export { extractCookieString, mergeCookies } from './cookie.util.js';
export type { HttpAuthSession } from './http-auth.types.js';

export { loginBarryGroup } from './barry-group.http-auth.js';
export { type MusgraveAuthMetadata, loginMusgrave } from './musgrave.http-auth.js';
export { loginOreillys } from './oreillys.http-auth.js';
export { loginSavageWhitten } from './savage-whitten.http-auth.js';

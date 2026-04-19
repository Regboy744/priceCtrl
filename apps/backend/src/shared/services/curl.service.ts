/**
 * curl-impersonate service for fetching pages with browser-like TLS fingerprints.
 *
 * Uses the system curl-impersonate binary to make HTTP requests that look
 * identical to real browser requests (TLS handshake, HTTP/2 settings, etc).
 *
 * Primary use case: fetching product pages with session cookies obtained
 * from Puppeteer login, avoiding the overhead of a full browser instance.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { env } from '../config/env.js';
import { createLogger } from './logger.service.js';
import { proxyService } from './proxy/index.js';

const execFileAsync = promisify(execFile);
const log = createLogger('CurlService');

// Override via CURL_IMPERSONATE_PATH when the binary lives somewhere other
// than the container default (/usr/local/bin/curl_chrome131). Kept configurable
// so dev machines (Arch/macOS) and Docker (Debian) both work without a code change.
const CURL_BINARY = env.curlImpersonatePath;

interface CurlOptions {
  /** HTTP method (default: GET) */
  method?: 'GET' | 'POST';
  /** Cookie string in "name=value; name2=value2" format */
  cookies?: string;
  /** Additional headers */
  headers?: Record<string, string>;
  /** POST body — URL-encoded form data or raw string */
  body?: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Follow redirects (default: true) */
  followRedirects?: boolean;
  /**
   * Capture response headers (default: false).
   * When true, Set-Cookie headers are returned in the response.
   */
  captureHeaders?: boolean;
  /**
   * Supplier key for proxy routing. When set, resolves per-supplier proxy
   * policy and appends `-x <proxyUrl>` so the request egresses through
   * Decodo. Omit for direct requests.
   */
  supplierKey?: string;
  /** Correlation ID used for per-job sticky sessions. */
  jobId?: string;
}

interface CurlResponse {
  body: string;
  statusCode: number;
  /** Set-Cookie values from response headers (only when captureHeaders is true) */
  setCookies?: string[];
}

class CurlService {
  /**
   * Fetch a URL using curl-impersonate.
   * Returns the response body as a string.
   */
  async fetch(url: string, options?: CurlOptions): Promise<CurlResponse> {
    const timeoutSec = Math.ceil((options?.timeout ?? 30000) / 1000);
    const captureHeaders = options?.captureHeaders ?? false;

    const args: string[] = [
      '-s', // silent
      '--compressed', // accept gzip/br, auto-decompress — reduces transfer size 20-40%
      '--max-time',
      timeoutSec.toString(),
    ];

    // When capturing headers, use -D - to dump headers to stdout
    // and a custom write-out separator to split headers from body.
    if (captureHeaders) {
      args.push('-D', '-'); // dump response headers to stdout (before body)
    }

    // Append status code at the very end
    args.push('-w', '\\n%{http_code}');

    if (options?.followRedirects !== false) {
      args.push('-L'); // follow redirects
    }

    // POST support — use --data-raw so curl automatically sets
    // Content-Length and POST method (no need for -X POST)
    if (options?.method === 'POST') {
      args.push('--data-raw', options.body ?? '');
    }

    if (options?.cookies) {
      args.push('-b', options.cookies);
    }

    if (options?.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        args.push('-H', `${key}: ${value}`);
      }
    }

    if (options?.supplierKey) {
      const creds = proxyService.buildCredentialsForSupplier(
        options.supplierKey,
        options.jobId
      );
      if (creds) {
        args.push('-x', creds.url);
        log.debug(
          { supplierKey: options.supplierKey, pool: creds.pool, jobId: options.jobId },
          'curl egress via proxy'
        );
      }
    }

    args.push(url);

    try {
      const { stdout } = await execFileAsync(CURL_BINARY, args, {
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: (options?.timeout ?? 30000) + 5000, // extra buffer
      });

      // Last line is the HTTP status code
      const lines = stdout.split('\n');
      const statusCode = Number.parseInt(lines.pop() ?? '0', 10);

      // Extract Set-Cookie headers when capturing
      let setCookies: string[] | undefined;
      let body: string;

      if (captureHeaders) {
        // -D - dumps response headers before the body, separated by \r\n\r\n.
        // With -L (follow redirects), each hop adds its own header block.
        // Headers always start with "HTTP/" — find the last header block,
        // then split body after its \r\n\r\n terminator.
        const raw = lines.join('\n');

        // Find all header block boundaries: each starts with HTTP/
        // The body starts after the \r\n\r\n that ends the last header block.
        let headerEnd = -1;
        let searchFrom = 0;
        while (true) {
          const sep = raw.indexOf('\r\n\r\n', searchFrom);
          if (sep === -1) break;
          // Check if what follows is another header block (starts with HTTP/)
          const afterSep = raw.slice(sep + 4);
          if (afterSep.startsWith('HTTP/')) {
            // Another redirect hop — keep searching
            searchFrom = sep + 4;
          } else {
            // This is the boundary between headers and body
            headerEnd = sep;
            break;
          }
        }

        if (headerEnd !== -1) {
          const allHeaders = raw.slice(0, headerEnd);
          body = raw.slice(headerEnd + 4);
          setCookies = allHeaders
            .split('\r\n')
            .filter((l) => l.toLowerCase().startsWith('set-cookie:'))
            .map((l) => l.slice('set-cookie:'.length).trim());
        } else {
          body = raw;
        }
      } else {
        body = lines.join('\n');
      }

      return { body, statusCode, setCookies };
    } catch (error) {
      const err = error as Error;
      log.error({ url, err }, 'curl-impersonate request failed');
      throw new Error(`curl request failed for ${url}: ${err.message}`);
    }
  }

  /**
   * Fetch multiple URLs in parallel using curl-impersonate.
   */
  async fetchMany(
    urls: string[],
    options?: CurlOptions & { concurrency?: number; delayMs?: number }
  ): Promise<Map<string, CurlResponse>> {
    const concurrency = options?.concurrency ?? 5;
    const delayMs = options?.delayMs ?? 200;
    const results = new Map<string, CurlResponse>();

    // Process in batches
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);

      const promises = batch.map(async (url, idx) => {
        // Stagger requests within batch
        if (idx > 0 && delayMs > 0) {
          await new Promise((r) => setTimeout(r, idx * delayMs));
        }
        const res = await this.fetch(url, options);
        return { url, res };
      });

      const batchResults = await Promise.all(promises);
      for (const { url, res } of batchResults) {
        results.set(url, res);
      }

      // Delay between batches
      if (i + concurrency < urls.length) {
        await new Promise((r) => setTimeout(r, delayMs * 2));
      }
    }

    return results;
  }
}

export const curlService = new CurlService();

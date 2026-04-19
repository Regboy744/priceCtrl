/**
 * Base class for HTTP-only ordering handlers.
 *
 * Implements `IOrderHandler` directly with zero Puppeteer dependency. Login
 * is delegated to the shared `http-auth` modules so a supplier's auth flow
 * lives in exactly one place and is shared with its scraper.
 *
 * Subclasses get small `httpGet` / `httpPostForm` / `httpPostJson` helpers
 * that route through `curl_chrome131` with the session cookies obtained at
 * login. Supplier-specific auth context that isn't a cookie (e.g. Musgrave's
 * apiToken) lives in `sessionMetadata`.
 */

import { curlService } from '../../shared/services/curl.service.js';
import type { HttpAuthSession } from '../../shared/services/http-auth/index.js';
import { createLogger } from '../../shared/services/logger.service.js';
import type { SupplierCredentials } from '../../shared/services/vault.service.js';
import type {
  IOrderHandler,
  OrderItemRequest,
  OrderItemResult,
  SupplierOrderConfig,
} from './ordering.types.js';

interface HttpResponse {
  status: number;
  body: string;
}

export abstract class BaseHttpOrderHandler implements IOrderHandler {
  supplierId = '';

  abstract readonly supplierName: string;
  abstract readonly name: string;
  abstract readonly baseUrl: string;
  abstract readonly config: SupplierOrderConfig;

  protected sessionCookies = '';
  protected sessionMetadata: Record<string, unknown> | undefined;

  protected get log() {
    if (!this._log) {
      this._log = createLogger(this.name);
    }
    return this._log;
  }
  private _log: ReturnType<typeof createLogger> | null = null;

  // ============ Abstract ============

  abstract login(credentials: SupplierCredentials): Promise<void>;
  abstract submitOrder(items: OrderItemRequest[]): Promise<OrderItemResult[]>;

  // ============ Lifecycle ============

  async initialize(): Promise<void> {
    // No browser to spin up — pure HTTP handler.
  }

  async cleanup(): Promise<void> {
    this.sessionCookies = '';
    this.sessionMetadata = undefined;
  }

  // ============ Getters ============

  getBasketUrl(): string {
    return this.config.basketUrl;
  }

  // ============ Auth Helpers ============

  /**
   * Store the session returned by an http-auth login module.
   * Subclasses call this from their `login()` after invoking the supplier
   * module so the helpers below have everything they need.
   */
  protected setSession(session: HttpAuthSession): void {
    this.sessionCookies = session.cookies;
    this.sessionMetadata = session.metadata;
  }

  protected requireSession(): void {
    if (!this.sessionCookies && !this.sessionMetadata) {
      throw new Error(`[${this.name}] Not authenticated. Call login() first.`);
    }
  }

  // ============ HTTP Helpers (curl-impersonate) ============

  protected async httpGet(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    const res = await curlService.fetch(url, {
      cookies: this.sessionCookies || undefined,
      headers,
    });
    return { status: res.statusCode, body: res.body };
  }

  protected async httpPostForm(
    url: string,
    data: Record<string, string>,
    headers?: Record<string, string>
  ): Promise<HttpResponse> {
    const body = new URLSearchParams(data).toString();
    const res = await curlService.fetch(url, {
      method: 'POST',
      body,
      cookies: this.sessionCookies || undefined,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...headers,
      },
    });
    return { status: res.statusCode, body: res.body };
  }

  protected async httpPostJson(
    url: string,
    data: unknown,
    headers?: Record<string, string>
  ): Promise<HttpResponse> {
    const res = await curlService.fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      cookies: this.sessionCookies || undefined,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...headers,
      },
    });
    return { status: res.statusCode, body: res.body };
  }

  // ============ Result helpers ============

  /** Mark every item as failed with the same error message. */
  protected failAll(items: OrderItemRequest[], error: string): OrderItemResult[] {
    return items.map((item) => ({
      supplier_product_code: item.supplier_product_code,
      success: false,
      error,
    }));
  }

  /** Mark every item as successful. */
  protected succeedAll(items: OrderItemRequest[]): OrderItemResult[] {
    return items.map((item) => ({
      supplier_product_code: item.supplier_product_code,
      success: true,
    }));
  }
}

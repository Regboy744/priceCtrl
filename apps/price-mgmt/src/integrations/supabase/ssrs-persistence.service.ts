import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './client.js';
import type {
  CreateRunInput,
  FinalizeRunInput,
  InsertRawBatchInput,
  InsertRawBatchResult,
  SsrsScrapeRunInsert,
  SsrsScrapeRunUpdate,
  SsrsStoreProductRowInsert,
} from './ssrs.types.js';

const INSERT_BATCH_SIZE = 500;

function sanitizeRequiredText(value: string | undefined): string {
  return String(value ?? '').trim();
}

function sanitizeOptionalText(value: string | undefined): string | null {
  const sanitized = sanitizeRequiredText(value);
  return sanitized.length > 0 ? sanitized : null;
}

function parseOptionalNumeric(value: string | undefined): number | null {
  const sanitized = sanitizeRequiredText(value)
    .replace(/,/g, '')
    .replace(/[^0-9.-]/g, '');

  if (!sanitized || sanitized === '-' || sanitized === '.' || sanitized === '-.') {
    return null;
  }

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStoreDescriptor(storeValue: string, storeText: string): {
  storeNumber: string;
  storeName: string;
} {
  const normalizedValue = sanitizeRequiredText(storeValue);
  const normalizedText = sanitizeRequiredText(storeText);
  const textParts = normalizedText
    .split(' - ')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const storeNumber = normalizedValue || textParts[0] || normalizedText;
  const storeName = textParts.length > 1 ? textParts.slice(1).join(' - ') : normalizedText;

  return {
    storeNumber: storeNumber || 'unknown-store',
    storeName: storeName || normalizedValue || 'Unknown Store',
  };
}

function parseLocationNumber(storeNumber: string): number | null {
  if (!/^\d+$/.test(storeNumber)) {
    return null;
  }

  const parsed = Number.parseInt(storeNumber, 10);
  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

export interface SsrsPersistenceService {
  createRun(input: CreateRunInput): Promise<string>;
  insertRawBatch(input: InsertRawBatchInput): Promise<InsertRawBatchResult>;
  resolveLocationId(companyId: string, storeNumber: string): Promise<string | null>;
  mergeRunToCurrent(runId: string): Promise<number>;
  finalizeRun(input: FinalizeRunInput): Promise<void>;
}

class SupabaseSsrsPersistenceService implements SsrsPersistenceService {
  private readonly client: SupabaseClient;
  private readonly locationCache = new Map<string, string | null>();

  constructor(url: string, serviceRoleKey: string) {
    this.client = getSupabaseClient(url, serviceRoleKey);
  }

  async createRun(input: CreateRunInput): Promise<string> {
    const payload: SsrsScrapeRunInsert = {
      company_id: input.companyId,
      source_job_id: input.sourceJobId,
      status: 'running',
      started_at: input.startedAt ?? new Date().toISOString(),
      raw_rows_inserted: 0,
      current_rows_merged: 0,
    };

    const { data, error } = await this.client
      .from('ssrs_scrape_runs')
      .insert(payload)
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create Supabase SSRS run: ${error?.message || 'Unknown error.'}`);
    }

    return data.id;
  }

  async resolveLocationId(companyId: string, storeNumber: string): Promise<string | null> {
    const cacheKey = `${companyId}:${storeNumber}`;
    const cached = this.locationCache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const locationNumber = parseLocationNumber(storeNumber);
    if (locationNumber === null) {
      this.locationCache.set(cacheKey, null);
      return null;
    }

    const { data, error } = await this.client
      .from('locations')
      .select('id')
      .eq('company_id', companyId)
      .eq('location_number', locationNumber)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve location for store ${storeNumber}: ${error.message}`);
    }

    const locationId = data?.id ?? null;
    this.locationCache.set(cacheKey, locationId);
    return locationId;
  }

  async insertRawBatch(input: InsertRawBatchInput): Promise<InsertRawBatchResult> {
    if (!input.rows.length) {
      return {
        rowsInserted: 0,
        unmatchedStoreNumber: null,
      };
    }

    const { storeNumber, storeName } = parseStoreDescriptor(input.storeValue, input.storeText);
    const locationId = await this.resolveLocationId(input.companyId, storeNumber);
    const scrapedAt = new Date().toISOString();

    const payloadRows: SsrsStoreProductRowInsert[] = input.rows.map((row, index) => ({
      run_id: input.runId,
      company_id: input.companyId,
      location_id: locationId,
      store_number: storeNumber,
      store_name: storeName,
      page_number: input.pageNumber,
      row_index: index,
      department_code: sanitizeOptionalText(row.departmentCode),
      department_name: sanitizeOptionalText(row.departmentName),
      subdepartment_code: sanitizeOptionalText(row.subdepartmentCode),
      subdepartment_name: sanitizeOptionalText(row.subdepartmentName),
      commodity_code: sanitizeOptionalText(row.commodityCode),
      commodity_name: sanitizeOptionalText(row.commodityName),
      family_code: sanitizeOptionalText(row.familyCode),
      family_name: sanitizeOptionalText(row.familyName),
      ean_plu: sanitizeRequiredText(row.ean_plu),
      root_article_code: sanitizeRequiredText(row.root_article_code),
      lu: sanitizeOptionalText(row.lu),
      lv: sanitizeOptionalText(row.lv),
      sv_code: sanitizeOptionalText(row.sv_code),
      description: sanitizeRequiredText(row.description),
      size: sanitizeOptionalText(row.size),
      must_stock: sanitizeOptionalText(row.must_stock),
      delisted: sanitizeOptionalText(row.delisted),
      store_selling_price: parseOptionalNumeric(row.store_selling_price),
      cost_price: parseOptionalNumeric(row.cost_price),
      vat: sanitizeOptionalText(row.vat),
      case_qty: sanitizeOptionalText(row.case_qty),
      margin_percent: sanitizeOptionalText(row.margin_percent),
      drs: sanitizeOptionalText(row.drs),
      supplier: sanitizeOptionalText(row.supplier),
      article_linking: sanitizeOptionalText(row.article_linking),
      scraped_at: scrapedAt,
    }));

    let rowsInserted = 0;

    for (let offset = 0; offset < payloadRows.length; offset += INSERT_BATCH_SIZE) {
      const chunk = payloadRows.slice(offset, offset + INSERT_BATCH_SIZE);
      const { error } = await this.client.from('ssrs_store_product_rows').insert(chunk);

      if (error) {
        throw new Error(`Failed to insert SSRS raw product batch: ${error.message}`);
      }

      rowsInserted += chunk.length;
    }

    return {
      rowsInserted,
      unmatchedStoreNumber: locationId ? null : storeNumber,
    };
  }

  async mergeRunToCurrent(runId: string): Promise<number> {
    const { data, error } = await this.client.rpc('merge_ssrs_run_to_current', {
      p_run_id: runId,
    });

    if (error) {
      throw new Error(`Failed to merge SSRS run ${runId} to current: ${error.message}`);
    }

    return typeof data === 'number' ? data : 0;
  }

  async finalizeRun(input: FinalizeRunInput): Promise<void> {
    const payload: SsrsScrapeRunUpdate = {
      status: input.status,
      completed_at: input.completedAt ?? new Date().toISOString(),
      raw_rows_inserted: Math.max(0, input.rawRowsInserted),
      current_rows_merged: Math.max(0, input.currentRowsMerged),
    };

    const { error } = await this.client
      .from('ssrs_scrape_runs')
      .update(payload)
      .eq('id', input.runId);

    if (error) {
      throw new Error(`Failed to finalize Supabase SSRS run ${input.runId}: ${error.message}`);
    }
  }
}

export function createSsrsPersistenceService(
  url: string,
  serviceRoleKey: string
): SsrsPersistenceService {
  return new SupabaseSsrsPersistenceService(url, serviceRoleKey);
}

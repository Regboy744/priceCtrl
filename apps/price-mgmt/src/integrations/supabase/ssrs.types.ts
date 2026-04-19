import type { ProductRow } from '../../scrape/types.js';

export type SsrsRunStatus = 'running' | 'completed' | 'failed';

export interface SsrsScrapeRunRow {
  id: string;
  company_id: string;
  source_job_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  raw_rows_inserted: number;
  current_rows_merged: number;
  created_at: string;
  updated_at: string;
}

export interface SsrsScrapeRunInsert {
  company_id: string;
  source_job_id: string;
  status?: SsrsRunStatus;
  started_at?: string;
  completed_at?: string | null;
  raw_rows_inserted?: number;
  current_rows_merged?: number;
}

export interface SsrsScrapeRunUpdate {
  status?: SsrsRunStatus;
  completed_at?: string | null;
  raw_rows_inserted?: number;
  current_rows_merged?: number;
}

export interface SsrsStoreProductRowInsert {
  run_id: string;
  company_id: string;
  location_id?: string | null;
  store_number: string;
  store_name: string;
  page_number: number;
  row_index: number;
  department_code?: string | null;
  department_name?: string | null;
  subdepartment_code?: string | null;
  subdepartment_name?: string | null;
  commodity_code?: string | null;
  commodity_name?: string | null;
  family_code?: string | null;
  family_name?: string | null;
  ean_plu: string;
  root_article_code: string;
  lu?: string | null;
  lv?: string | null;
  sv_code?: string | null;
  description: string;
  size?: string | null;
  must_stock?: string | null;
  delisted?: string | null;
  store_selling_price?: number | null;
  cost_price?: number | null;
  vat?: string | null;
  case_qty?: string | null;
  margin_percent?: string | null;
  drs?: string | null;
  supplier?: string | null;
  article_linking?: string | null;
  scraped_at?: string;
}

export interface CreateRunInput {
  companyId: string;
  sourceJobId: string;
  startedAt?: string;
}

export interface FinalizeRunInput {
  runId: string;
  status: SsrsRunStatus;
  completedAt?: string;
  rawRowsInserted: number;
  currentRowsMerged: number;
}

export interface InsertRawBatchInput {
  companyId: string;
  runId: string;
  storeValue: string;
  storeText: string;
  pageNumber: number;
  rows: ProductRow[];
}

export interface InsertRawBatchResult {
  rowsInserted: number;
  unmatchedStoreNumber: string | null;
}

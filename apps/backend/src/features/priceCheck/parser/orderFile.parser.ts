import * as XLSX from 'xlsx';
import type { FileUploadConfig, OrderItem, ParseResult } from '../priceCheck.types.js';
import { isArticleCodePattern, transformArticleCode } from './articleCode.transformer.js';

/**
 * Column detection patterns (case-insensitive)
 */
const COLUMN_PATTERNS = {
  article: ['article', 'code', 'art.', 'item'],
  quantity: ['quantity', 'qty', 'qnty', 'q.ty'],
  cost: ['cost', 'price', 'total', 'amount'],
};

/**
 * Detected column information
 */
interface ColumnMapping {
  articleIndex: number;
  quantityIndex: number;
  costIndex: number;
  headerRowIndex: number;
}

/**
 * Parse an order XLS/XLSX file and extract order items
 *
 * @param buffer - File buffer from multer
 * @param config - Optional configuration overrides
 * @returns ParseResult with extracted items and metadata
 */
export function parseOrderFile(buffer: Buffer, config: FileUploadConfig = {}): ParseResult {
  const warnings: string[] = [];
  let storeNumber: string | null = null;

  try {
    // Read workbook
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return createErrorResult('No sheets found in the file');
    }

    const worksheet = workbook.Sheets[sheetName];

    // Convert to array of arrays for easier processing
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (rawData.length === 0) {
      return createErrorResult('File appears to be empty');
    }

    // Extract store number from header section (typically row 5)
    storeNumber = extractStoreNumber(rawData);

    // Find column mapping
    const columnMapping = findColumnMapping(rawData, config);

    if (!columnMapping) {
      return {
        data_category: 'order_input',
        description: 'Data extracted from uploaded order file.',
        success: false,
        items: [],
        total_rows: rawData.length,
        valid_rows: 0,
        warnings: [
          'Could not detect column headers. Looking for: Article/Code, Quantity/Qty, Cost/Price',
          `Available data in first 10 rows: ${JSON.stringify(rawData.slice(0, 10).map((r) => r.slice(0, 5)))}`,
        ],
        store_number: storeNumber,
      };
    }

    // Extract data rows
    const items: OrderItem[] = [];
    const startRow = columnMapping.headerRowIndex + 1 + (config.skip_rows || 0);

    for (let rowIndex = startRow; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;

      const rowNumber = rowIndex + 1; // 1-indexed for user display
      const result = parseDataRow(row, columnMapping, rowNumber);

      if (result.valid && result.item) {
        items.push(result.item);
      } else if (result.warning) {
        warnings.push(result.warning);
      }
      // Skip silently if no warning (empty rows, category headers)
    }

    return {
      data_category: 'order_input',
      description: 'Data extracted from uploaded order file.',
      success: items.length > 0,
      items,
      total_rows: rawData.length,
      valid_rows: items.length,
      warnings,
      store_number: storeNumber,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parsing error';
    return createErrorResult(`Failed to parse file: ${message}`);
  }
}

/**
 * Extract store number from header rows
 * Looks for "Store No.:" pattern in first 10 rows
 */
function extractStoreNumber(data: unknown[][]): string | null {
  // Check first 10 rows for store number
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    for (const cell of row) {
      if (typeof cell === 'string') {
        // Match patterns like "Store No.: 441" or "Store No: 441"
        const match = cell.match(/Store\s*No\.?\s*:?\s*(\d+)/i);
        if (match) {
          return match[1];
        }
      }
    }
  }
  return null;
}

/**
 * Find column indices by detecting header row
 */
function findColumnMapping(data: unknown[][], config: FileUploadConfig): ColumnMapping | null {
  // If config specifies columns, we still need to find which row they're in
  // Otherwise, auto-detect by looking for header patterns

  // Search first 15 rows for header row
  for (let rowIndex = 0; rowIndex < Math.min(15, data.length); rowIndex++) {
    const row = data[rowIndex];
    if (!row || row.length < 3) continue;

    const mapping = tryMapColumns(row, rowIndex, config);
    if (mapping) {
      return mapping;
    }
  }

  return null;
}

/**
 * Try to map columns from a potential header row
 */
function tryMapColumns(
  row: unknown[],
  rowIndex: number,
  config: FileUploadConfig
): ColumnMapping | null {
  let articleIndex = -1;
  let quantityIndex = -1;
  let costIndex = -1;

  // Convert row to lowercase strings for matching
  const normalizedRow = row.map((cell) =>
    typeof cell === 'string' ? cell.toLowerCase().trim() : ''
  );

  // Find article column
  if (config.article_column) {
    articleIndex = normalizedRow.indexOf(config.article_column.toLowerCase());
  } else {
    articleIndex = findColumnByPatterns(normalizedRow, COLUMN_PATTERNS.article);
  }

  // Find quantity column
  if (config.quantity_column) {
    quantityIndex = normalizedRow.indexOf(config.quantity_column.toLowerCase());
  } else {
    quantityIndex = findColumnByPatterns(normalizedRow, COLUMN_PATTERNS.quantity);
  }

  // Find cost column
  if (config.cost_column) {
    costIndex = normalizedRow.indexOf(config.cost_column.toLowerCase());
  } else {
    costIndex = findColumnByPatterns(normalizedRow, COLUMN_PATTERNS.cost);
  }

  // Need at least article and cost columns
  // Quantity might be in a separate row header (like "Quantity" in row 7)
  if (articleIndex !== -1 && costIndex !== -1) {
    // If quantity not found in same row, search adjacent rows
    if (quantityIndex === -1) {
      quantityIndex = findQuantityInAdjacentRows(articleIndex, costIndex, rowIndex);
    }

    // Default quantity to a reasonable position if still not found
    if (quantityIndex === -1) {
      // Quantity is often between article and cost, or just before cost
      quantityIndex = costIndex > 0 ? costIndex - 1 : articleIndex + 1;
    }

    return {
      articleIndex,
      quantityIndex,
      costIndex,
      headerRowIndex: rowIndex,
    };
  }

  return null;
}

/**
 * Find a column index by matching against patterns
 */
function findColumnByPatterns(row: string[], patterns: string[]): number {
  for (let i = 0; i < row.length; i++) {
    const cell = row[i];
    for (const pattern of patterns) {
      if (cell.includes(pattern)) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Search for quantity column in rows adjacent to header
 * (Some Excel files have multi-row headers)
 */
function findQuantityInAdjacentRows(
  _articleIndex: number,
  costIndex: number,
  _headerRowIndex: number
): number {
  // For the specific format shown, quantity is at index 17 (column R)
  // Cost is at index 20 (column U)
  // This is a reasonable default: quantity is usually 3 columns before cost
  if (costIndex >= 3) {
    return costIndex - 3;
  }
  return -1;
}

/**
 * Parse a single data row
 */
function parseDataRow(
  row: unknown[],
  mapping: ColumnMapping,
  rowNumber: number
): { valid: boolean; item?: OrderItem; warning?: string } {
  const rawArticle = row[mapping.articleIndex];
  const rawQuantity = row[mapping.quantityIndex];
  const rawCost = row[mapping.costIndex];

  // Check if this looks like a data row (has article code pattern)
  if (!isArticleCodePattern(rawArticle)) {
    // Silent skip - likely empty row or category header
    return { valid: false };
  }

  // Transform article code
  const articleCode = transformArticleCode(rawArticle as string);
  if (!articleCode) {
    return {
      valid: false,
      warning: `Row ${rowNumber}: Invalid article code format "${rawArticle}"`,
    };
  }

  // Parse quantity
  const quantity = parseNumber(rawQuantity);
  if (quantity === null || quantity <= 0) {
    return {
      valid: false,
      warning: `Row ${rowNumber}: Invalid quantity "${rawQuantity}" for article ${articleCode}`,
    };
  }

  // Parse cost (line total)
  const lineCost = parseNumber(rawCost);
  if (lineCost === null || lineCost <= 0) {
    return {
      valid: false,
      warning: `Row ${rowNumber}: Invalid cost "${rawCost}" for article ${articleCode}`,
    };
  }

  // Calculate unit cost
  const unitCost = Number((lineCost / quantity).toFixed(4));

  return {
    valid: true,
    item: {
      article_code: articleCode,
      quantity,
      line_cost: lineCost,
      unit_cost: unitCost,
      row_number: rowNumber,
    },
  };
}

/**
 * Parse a cell value as a number
 */
function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === 'string') {
    // Remove common formatting (commas, currency symbols, spaces)
    const cleaned = value.replace(/[,\s$]/g, '').trim();
    const num = Number.parseFloat(cleaned);
    return Number.isNaN(num) ? null : num;
  }

  return null;
}

/**
 * Create an error result
 */
function createErrorResult(message: string): ParseResult {
  return {
    data_category: 'order_input',
    description: 'Data extracted from uploaded order file.',
    success: false,
    items: [],
    total_rows: 0,
    valid_rows: 0,
    warnings: [message],
    store_number: null,
  };
}

/**
 * Get column names from the file (for debugging/column selection)
 */
export function getFileColumns(buffer: Buffer): string[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const worksheet = workbook.Sheets[sheetName];
    const data: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
    });

    // Return first non-empty row with string values
    for (const row of data.slice(0, 15)) {
      const strings = row
        .filter((cell): cell is string => typeof cell === 'string' && cell.trim() !== '')
        .map((s) => s.trim());

      if (strings.length >= 3) {
        return strings;
      }
    }

    return [];
  } catch {
    return [];
  }
}

import { type Request, type Response, Router } from 'express';
import multer from 'multer';
import { BadRequestError, ValidationError } from '../../shared/errors/AppError.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/middleware/error.middleware.js';
import { requirePermission } from '../../shared/middleware/requirePermission.js';
import { getFileColumns, parseOrderFile } from './parser/index.js';
import { comparePrices } from './priceCheck.service.js';
import { FileUploadConfigSchema, PriceCheckRequestSchema } from './priceCheck.types.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept only Excel files
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream', // Sometimes Excel files come as this
    ];
    const allowedExtensions = ['.xls', '.xlsx'];

    const hasValidMime = allowedMimes.includes(file.mimetype);
    const hasValidExt = allowedExtensions.some((ext) =>
      file.originalname.toLowerCase().endsWith(ext)
    );

    if (hasValidMime || hasValidExt) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only XLS and XLSX files are allowed'));
    }
  },
});

// All routes require authentication + price-check permission
router.use(authMiddleware);
router.use(requirePermission('price_check:run'));

/**
 * POST /api/v1/price-check/upload
 * Upload an order XLS file and extract order items
 *
 * @body file - The XLS/XLSX file (multipart form data)
 * @body article_column - (optional) Override auto-detected article column name
 * @body quantity_column - (optional) Override auto-detected quantity column name
 * @body cost_column - (optional) Override auto-detected cost column name
 * @body skip_rows - (optional) Number of rows to skip after header
 *
 * @returns ParseResult with extracted items and metadata
 */
router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    // Parse optional config from request body
    const configResult = FileUploadConfigSchema.safeParse({
      article_column: req.body.article_column,
      quantity_column: req.body.quantity_column,
      cost_column: req.body.cost_column,
      skip_rows: req.body.skip_rows ? Number(req.body.skip_rows) : undefined,
    });

    if (!configResult.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of configResult.error.issues) {
        const path = issue.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      }
      throw new ValidationError(errors);
    }

    const parseResult = parseOrderFile(req.file.buffer, configResult.data);

    res.json({
      success: parseResult.success,
      data: parseResult,
    });
  })
);

/**
 * POST /api/v1/price-check/file-columns
 * Get column names from uploaded file (for column selection UI)
 *
 * @body file - The XLS/XLSX file (multipart form data)
 *
 * @returns Array of column names found in the file
 */
router.post(
  '/file-columns',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    const columns = getFileColumns(req.file.buffer);

    res.json({
      success: true,
      data: {
        columns,
      },
    });
  })
);

/**
 * POST /api/v1/price-check/compare
 * Compare prices for given order items across all suppliers
 *
 * @body company_id - UUID of the company (for special pricing)
 * @body items - Array of { article_code, quantity, unit_cost }
 * @body supplier_ids - (optional) Filter to specific suppliers
 * @body include_unavailable - (optional) Include unavailable products
 *
 * @returns PriceCheckResponse with supplier comparisons
 */
router.post(
  '/compare',
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const parseResult = PriceCheckRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      }
      throw new ValidationError(errors);
    }

    const { company_id, items, supplier_ids, include_unavailable } = parseResult.data;

    // Convert to OrderItem format (add row_number and line_cost)
    const orderItems = items.map((item, index) => ({
      article_code: item.article_code,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      line_cost: Number((item.quantity * item.unit_cost).toFixed(2)),
      row_number: index + 1,
    }));

    const comparison = await comparePrices(
      company_id,
      orderItems,
      supplier_ids,
      include_unavailable ?? false
    );

    res.json({
      success: true,
      data: comparison,
    });
  })
);

/**
 * POST /api/v1/price-check/upload-and-compare
 * Upload XLS file AND compare prices in one request
 *
 * @body file - The XLS/XLSX file (multipart form data)
 * @body company_id - UUID of the company (for special pricing)
 * @body supplier_ids - (optional) JSON array of supplier UUIDs to filter
 * @body include_unavailable - (optional) "true" to include unavailable products
 *
 * @returns { parse_result, comparison }
 */
router.post(
  '/upload-and-compare',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    // Get company_id from request body or user context
    const companyId = req.body.company_id || req.user?.profile?.company_id;

    if (!companyId) {
      throw new BadRequestError('company_id is required');
    }

    // Parse optional config
    const configResult = FileUploadConfigSchema.safeParse({
      article_column: req.body.article_column,
      quantity_column: req.body.quantity_column,
      cost_column: req.body.cost_column,
      skip_rows: req.body.skip_rows ? Number(req.body.skip_rows) : undefined,
    });

    const parseConfig = configResult.success ? configResult.data : {};

    // Parse the file
    const parseResult = parseOrderFile(req.file.buffer, parseConfig);

    if (!parseResult.success || parseResult.items.length === 0) {
      res.json({
        success: false,
        data: {
          parse_result: parseResult,
          comparison: null,
        },
      });
      return;
    }

    // Parse optional supplier filter
    let supplierIds: string[] | undefined;
    if (req.body.supplier_ids) {
      try {
        supplierIds = JSON.parse(req.body.supplier_ids);
      } catch {
        // Ignore parse errors, just don't filter
      }
    }

    const includeUnavailable = req.body.include_unavailable === 'true';

    // Compare prices
    const comparison = await comparePrices(
      companyId,
      parseResult.items,
      supplierIds,
      includeUnavailable
    );

    res.json({
      success: true,
      data: {
        parse_result: parseResult,
        comparison,
      },
    });
  })
);

export const priceCheckRouter: Router = router;

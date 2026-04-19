import { z } from 'zod'
import { ACCOUNT_TYPES } from '@/features/masterProducts/types'

// Validation schema for master product form
export const masterProductValidationSchema = z.object({
 brand_id: z.string().uuid('Please select a brand'),
 article_code: z
  .string()
  .min(1, 'Article code is required')
  .max(50, 'Article code must be less than 50 characters'),
 ean_code: z
  .string()
  .min(1, 'EAN code is required')
  .max(20, 'EAN code must be less than 20 characters'),
 description: z
  .string()
  .min(1, 'Description is required')
  .min(3, 'Description must be at least 3 characters')
  .max(255, 'Description must be less than 255 characters'),
 account: z
  .enum(ACCOUNT_TYPES, { message: 'Please select a valid account type' })
  .nullable()
  .optional(),
 unit_size: z
  .string()
  .max(50, 'Unit size must be less than 50 characters')
  .nullable()
  .optional(),
 is_active: z.boolean(),
})

export type MasterProductFormValues = z.infer<
 typeof masterProductValidationSchema
>

// Validation schema for CSV row
export const csvRowSchema = z.object({
 article_code: z
  .string()
  .min(1, 'Article code is required')
  .max(50, 'Article code must be less than 50 characters'),
 ean_code: z
  .string()
  .min(1, 'EAN code is required')
  .max(20, 'EAN code must be less than 20 characters'),
 description: z
  .string()
  .min(1, 'Description is required')
  .min(3, 'Description must be at least 3 characters')
  .max(255, 'Description must be less than 255 characters'),
 account: z.string().optional(),
 unit_size: z.string().optional(),
})

export type CsvRowValues = z.infer<typeof csvRowSchema>

interface RawCsvRow {
 article_code?: string
 ean_code?: string
 description?: string
 account?: string
 unit_size?: string
 [key: string]: unknown
}

// Validate array of CSV rows
export const validateCsvRows = (
 rows: unknown[],
): {
 validRows: CsvRowValues[]
 errors: { row: number; field: string; message: string }[]
} => {
 const validRows: CsvRowValues[] = []
 const errors: { row: number; field: string; message: string }[] = []

 rows.forEach((row, index) => {
  // Trim string fields before validation
  const rawRow = row as RawCsvRow
  const trimmedRow: RawCsvRow = {
   ...rawRow,
   article_code: rawRow.article_code?.trim(),
   ean_code: rawRow.ean_code?.trim(),
   description: rawRow.description?.trim(),
   account: rawRow.account?.trim(),
   unit_size: rawRow.unit_size?.trim(),
  }

  const result = csvRowSchema.safeParse(trimmedRow)
  if (result.success) {
   validRows.push(result.data)
  } else {
   result.error.issues.forEach((issue) => {
    errors.push({
     row: index + 1, // 1-indexed for user display
     field: issue.path.join('.'),
     message: issue.message,
    })
   })
  }
 })

 return { validRows, errors }
}

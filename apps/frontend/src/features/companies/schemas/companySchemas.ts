import { z } from 'zod'

// Supplier validation schema
export const supplierValidationSchema = z.object({
 name: z
  .string()
  .min(1, 'Supplier name is required')
  .min(3, 'Supplier name must be at least 3 characters')
  .max(100, 'Supplier name must not exceed 100 characters'),
 is_active: z.boolean(),
})

// Company validation schema (company-only, no address fields)
export const companyValidationSchema = z.object({
 name: z
  .string()
  .min(1, 'Company name is required')
  .min(3, 'Company name must be at least 3 characters')
  .max(100, 'Company name must not exceed 100 characters'),
 brand_id: z.string().uuid('Please select a brand').nullable(),
 phone: z
  .string()
  .min(1, 'Phone number is required')
  .refine((val) => /^\+353\s[0-9]{1,2}\s[0-9]{3}\s[0-9]{4}$/.test(val), {
   message: 'Phone must be in format: +353 1 234 5678 or +353 87 123 4567',
  }),
 email: z.string().email('Invalid email address'),
 is_active: z.boolean(),
})

export type CompanyFormValues = z.infer<typeof companyValidationSchema>

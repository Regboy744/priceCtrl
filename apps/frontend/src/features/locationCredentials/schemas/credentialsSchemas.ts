import { z } from 'zod'

// Credential validation schema for create
export const credentialCreateSchema = z.object({
 supplier_id: z.uuid('Invalid supplier ID'),
 username: z
  .string()
  .min(1, 'Username is required')
  .max(100, 'Username must not exceed 100 characters'),
 password: z
  .string()
  .min(1, 'Password is required')
  .max(200, 'Password must not exceed 200 characters'),
 website_url: z.url('Invalid URL format').optional().or(z.literal('')),
 login_url: z.url('Invalid URL format').optional().or(z.literal('')),
 is_active: z.boolean(),
})

// Credential validation schema for update (password optional)
export const credentialUpdateSchema = z.object({
 supplier_id: z.uuid('Invalid supplier ID'),
 username: z
  .string()
  .min(1, 'Username is required')
  .max(100, 'Username must not exceed 100 characters'),
 password: z
  .string()
  .max(200, 'Password must not exceed 200 characters')
  .optional()
  .or(z.literal('')),
 website_url: z.url('Invalid URL format').optional().or(z.literal('')),
 login_url: z.url('Invalid URL format').optional().or(z.literal('')),
 is_active: z.boolean(),
})

export type CredentialCreateInput = z.infer<typeof credentialCreateSchema>
export type CredentialUpdateInput = z.infer<typeof credentialUpdateSchema>

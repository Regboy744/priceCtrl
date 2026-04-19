import { z } from 'zod'
import { ADDRESS_TYPES } from '@/features/addresses/types'

export const addressValidationSchema = z.object({
 street_address: z
  .string()
  .min(1, 'Street address is required')
  .min(3, 'Street address must be at least 3 characters')
  .max(200, 'Street address must not exceed 200 characters'),
 address_line2: z
  .string()
  .max(200, 'Address line 2 must not exceed 200 characters')
  .optional()
  .or(z.literal('')),
 city: z
  .string()
  .min(1, 'City is required')
  .min(2, 'City must be at least 2 characters')
  .max(100, 'City must not exceed 100 characters'),
 county: z
  .string()
  .min(1, 'County is required')
  .min(2, 'County must be at least 2 characters')
  .max(100, 'County must not exceed 100 characters'),
 eircode: z
  .string()
  .min(1, 'Eircode is required')
  .min(7, 'Eircode must be at least 7 characters')
  .max(10, 'Eircode must not exceed 10 characters'),
 country: z
  .string()
  .min(1, 'Country is required')
  .max(100, 'Country must not exceed 100 characters'),
 address_type: z.enum(ADDRESS_TYPES, {
  message: 'Please select an address type',
 }),
 is_active: z.boolean(),
})

export type AddressFormValues = z.infer<typeof addressValidationSchema>

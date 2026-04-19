import { z } from 'zod'
import { LOCATION_TYPES } from '@/features/locations/types'

export const locationValidationSchema = z.object({
 name: z
  .string()
  .min(1, 'Location name is required')
  .min(3, 'Location name must be at least 3 characters')
  .max(100, 'Location name must not exceed 100 characters'),
 location_number: z
  .number({ message: 'Location number is required' })
  .int('Location number must be a whole number')
  .min(1, 'Location number must be at least 1')
  .max(999999, 'Location number must not exceed 999999'),
 location_type: z.enum(LOCATION_TYPES, {
  message: 'Please select a location type',
 }),
 is_active: z.boolean(),
})

export type LocationFormValues = z.infer<typeof locationValidationSchema>

import { z } from 'zod'
import { DATE_PRESETS } from '@/features/orders/types'

export const orderFiltersSchema = z.object({
 companyId: z.string().uuid('Invalid company ID').nullable(),
 locationId: z.string().uuid('Invalid location ID').nullable(),
 dateFrom: z.string().datetime().nullable(),
 dateTo: z.string().datetime().nullable(),
 datePreset: z.enum(DATE_PRESETS).optional(),
})

export type OrderFiltersFormValues = z.infer<typeof orderFiltersSchema>

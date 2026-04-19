import { z } from 'zod'

// Single threshold setting validation
export const thresholdSettingSchema = z.object({
 supplier_id: z.string().uuid('Invalid supplier ID'),
 threshold_percentage: z
  .number()
  .min(0, 'Threshold must be at least 0%')
  .max(100, 'Threshold must not exceed 100%'),
 special_pricing_enabled: z.boolean(),
 is_active: z.boolean(),
})

// Array of threshold settings for bulk save
export const thresholdSettingsArraySchema = z.array(thresholdSettingSchema)

export type ThresholdSettingInput = z.infer<typeof thresholdSettingSchema>
export type ThresholdSettingsArrayInput = z.infer<
 typeof thresholdSettingsArraySchema
>

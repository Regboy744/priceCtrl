import { apiClient } from '@/lib/apiClient'
import type { ThresholdSettingFormData } from '@/features/companySettings/types'
import type { Tables } from '@/types/shared/database.types'

type CompanySupplierSetting = Tables<'company_supplier_settings'>

interface MutationResult<T> {
 success: boolean
 data?: T
 error?: Error
}

const toMutationResult = <T>(res: {
 success: boolean
 data?: T
 error?: { message: string }
}): MutationResult<T> => ({
 success: res.success,
 data: res.data,
 error: res.error ? new Error(res.error.message) : undefined,
})

// Upsert all threshold settings for a company (bulk save)
export const upsertThresholdSettings = async (
 companyId: string,
 settings: ThresholdSettingFormData[],
) => {
 const res = await apiClient.post<CompanySupplierSetting[]>(
  '/company-settings/upsert',
  {
   company_id: companyId,
   settings: settings.map((s) => ({
    supplier_id: s.supplier_id,
    threshold_percentage: s.threshold_percentage,
    special_pricing_enabled: s.special_pricing_enabled,
    is_active: s.is_active,
   })),
  },
 )
 return toMutationResult(res)
}

// Update single threshold setting
export const updateThresholdSetting = async (
 settingId: string,
 data: Partial<ThresholdSettingFormData>,
) => {
 const res = await apiClient.patch<CompanySupplierSetting>(
  `/company-settings/${encodeURIComponent(settingId)}`,
  {
   threshold_percentage: data.threshold_percentage,
   special_pricing_enabled: data.special_pricing_enabled,
   is_active: data.is_active,
  },
 )
 return toMutationResult(res)
}

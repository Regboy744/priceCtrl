import { ref, type Ref } from 'vue'
import { useErrorStore } from '@/stores/error'
import {
 allSuppliersQuery,
 companySupplierSettingsQuery,
} from '@/features/companySettings/api/queries'
import { upsertThresholdSettings } from '@/features/companySettings/api/mutations'
import type {
 SupplierWithSetting,
 ThresholdSettingFormData,
} from '@/features/companySettings/types'

export const useCompanySupplierSettings = (companyId: Ref<string>) => {
 const suppliersWithSettings = ref<SupplierWithSetting[]>([])
 const isLoading = ref(false)
 const isSaving = ref(false)
 const errorStore = useErrorStore()

 // Fetch all suppliers and merge with existing settings
 const fetchSuppliersWithSettings = async () => {
  isLoading.value = true
  try {
   // Fetch suppliers and settings in parallel
   const [suppliersResult, settingsResult] = await Promise.all([
    allSuppliersQuery(),
    companySupplierSettingsQuery(companyId.value),
   ])

   if (suppliersResult.error) {
    errorStore.setError({
     error: suppliersResult.error,
     customCode: suppliersResult.status,
    })
    return null
   }

   if (settingsResult.error) {
    errorStore.setError({
     error: settingsResult.error,
     customCode: settingsResult.status,
    })
    return null
   }

   const suppliers = suppliersResult.data ?? []
   const settings = settingsResult.data ?? []

   // Create a map of existing settings by supplier_id
   const settingsMap = new Map(settings.map((s) => [s.supplier_id, s]))

   // Merge suppliers with their settings (or defaults)
   suppliersWithSettings.value = suppliers.map((supplier) => {
    const existingSetting = settingsMap.get(supplier.id)
    return {
     supplier_id: supplier.id,
     supplier_name: supplier.name,
     setting_id: existingSetting?.id ?? null,
     threshold_percentage: existingSetting?.threshold_percentage ?? 0,
     special_pricing_enabled: existingSetting?.special_pricing_enabled ?? false,
     is_active: existingSetting?.is_active ?? true,
    }
   })

   return suppliersWithSettings.value
  } finally {
   isLoading.value = false
  }
 }

 // Save all settings
 const saveAllSettings = async (settings: ThresholdSettingFormData[]) => {
  isSaving.value = true
  try {
   const result = await upsertThresholdSettings(companyId.value, settings)

   if (!result.success) {
    errorStore.setError({
     error: result.error as Error,
     customCode: 500,
    })
    return false
   }

   // Refresh the data
   await fetchSuppliersWithSettings()
   return true
  } finally {
   isSaving.value = false
  }
 }

 // Update local state (for reactive UI before save)
 const updateLocalSetting = (
  supplierId: string,
  field: 'threshold_percentage' | 'special_pricing_enabled' | 'is_active',
  value: number | boolean,
 ) => {
  const setting = suppliersWithSettings.value.find(
   (s) => s.supplier_id === supplierId,
  )
  if (setting) {
   if (field === 'threshold_percentage') {
    setting.threshold_percentage = value as number
    return
   }

   if (field === 'special_pricing_enabled') {
    setting.special_pricing_enabled = value as boolean
    return
   }

   setting.is_active = value as boolean
  }
 }

 return {
  suppliersWithSettings,
  isLoading,
  isSaving,
  fetchSuppliersWithSettings,
  saveAllSettings,
  updateLocalSetting,
 }
}

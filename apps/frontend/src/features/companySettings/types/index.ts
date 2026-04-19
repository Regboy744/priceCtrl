import type {
 Tables,
 TablesInsert,
 TablesUpdate,
} from '@/types/shared/database.types'

// Database types
export type CompanySupplierSetting = Tables<'company_supplier_settings'>
export type CompanySupplierSettingInsert =
 TablesInsert<'company_supplier_settings'>
export type CompanySupplierSettingUpdate =
 TablesUpdate<'company_supplier_settings'>

export type Supplier = Tables<'suppliers'>

// UI types - Merged supplier with its setting
export interface SupplierWithSetting {
 supplier_id: string
 supplier_name: string
 setting_id: string | null // null if no setting exists yet
 threshold_percentage: number
 special_pricing_enabled: boolean
 is_active: boolean
}

// Form data for saving
export interface ThresholdSettingFormData {
 supplier_id: string
 threshold_percentage: number
 special_pricing_enabled: boolean
 is_active: boolean
}

import type {
 Tables,
 TablesInsert,
 TablesUpdate,
} from '@/types/shared/database.types'

// Company types from database
export type Company = Tables<'companies'>
export type CompanyInsert = TablesInsert<'companies'>
export type CompanyUpdate = TablesUpdate<'companies'>

// Brand type from database
export type Brand = Tables<'brands'>

// Simplified brand for queries (what we actually select)
export interface BrandOption {
 id: string
 name: string
}

// Company with brand relation (for display)
export interface CompanyWithBrand extends Company {
 brands: BrandOption | null
}

// Form data type (used by CompanyEditForm)
export interface CompanyFormData {
 id?: string
 name: string
 brand_id: string | null
 phone: string
 email: string
 is_active: boolean
}

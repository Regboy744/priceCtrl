import type {
 Tables,
 TablesInsert,
 TablesUpdate,
} from '@/types/shared/database.types'

// Database types
export type MasterProduct = Tables<'master_products'>
export type MasterProductInsert = TablesInsert<'master_products'>
export type MasterProductUpdate = TablesUpdate<'master_products'>

export type Brand = Tables<'brands'>

// Simplified brand for dropdown
export interface BrandOption {
 id: string
 name: string
 is_active: boolean | null
}

// Master product with brand name (joined query)
export interface MasterProductWithBrand extends MasterProduct {
 brands: {
  name: string
 } | null
}

// Form data type
export interface MasterProductFormData {
 id?: string
 brand_id: string
 article_code: string
 ean_code: string
 description: string
 account?: string | null
 unit_size?: string | null
 is_active: boolean
}

// CSV row type (what we expect from CSV file)
export interface CsvRow {
 article_code: string
 ean_code: string
 description: string
 account?: string
 unit_size?: string
}

// CSV validation result
export interface CsvValidationResult {
 isValid: boolean
 validRows: CsvRow[]
 errors: CsvValidationError[]
}

export interface CsvValidationError {
 row: number
 field: string
 message: string
 value?: string
}

// CSV preview data for import
export interface CsvPreviewItem {
 article_code: string
 ean_code: string
 description: string
 account?: string
 unit_size?: string
}

export interface CsvPreviewData {
 brandId: string
 brandName: string
 items: CsvPreviewItem[]
 summary: {
  total: number
 }
}

// Upsert result
export interface UpsertResult {
 success: boolean
 inserted: number
 skipped: number
 errors?: string[]
}

// Progress tracking for batch upsert operations
export interface UpsertProgress {
 phase: 'fetching' | 'processing' | 'inserting' | 'complete'
 current: number
 total: number
 message: string
}

// Options for upsert operations
export interface UpsertOptions {
 onProgress?: (progress: UpsertProgress) => void
 signal?: { cancelled: boolean }
}

// Account types constant
export const ACCOUNT_TYPES = [
 'DAIRY_PRODUCTS',
 'FRESH_MEAT',
 'FROZEN_FOODS',
 'BAKERY_ITEMS',
 'BEVERAGES',
 'SNACKS_CHIPS',
 'CANNED_GOODS',
 'CEREALS_GRAINS',
 'FRESH_PRODUCE',
 'CLEANING_SUPPLIES',
 'PERSONAL_CARE',
 'BABY_PRODUCTS',
 'PET_SUPPLIES',
 'HEALTH_WELLNESS',
 'CONDIMENTS_SAUCES',
 'BREAKFAST_ITEMS',
 'DELI_PREPARED',
 'ALCOHOL_BEER',
 'PAPER_PRODUCTS',
 'HOUSEHOLD_ITEMS',
] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]

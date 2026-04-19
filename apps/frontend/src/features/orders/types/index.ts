import type {
 Tables,
 TablesInsert,
 TablesUpdate,
} from '@/types/shared/database.types'

// Base database types
export type Order = Tables<'orders'>
export type OrderInsert = TablesInsert<'orders'>
export type OrderUpdate = TablesUpdate<'orders'>

export type OrderItem = Tables<'order_items'>
export type OrderItemInsert = TablesInsert<'order_items'>
export type OrderItemUpdate = TablesUpdate<'order_items'>

export type Location = Tables<'locations'>
export type Company = Tables<'companies'>

// Date preset constants
export const DATE_PRESETS = [
 'today',
 'week',
 'month',
 'lastMonth',
 'custom',
] as const
export type DatePreset = (typeof DATE_PRESETS)[number]

// Order filters
export interface OrderFilters {
 companyId: string | null
 locationId: string | null // null means "All Locations"
 dateFrom: string | null // ISO date string
 dateTo: string | null // ISO date string
 datePreset?: DatePreset
}

// Order with location info (for list view)
export interface OrderWithLocation {
 id: string
 order_date: string
 total_amount: number | null
 notes: string | null
 created_at: string | null
 locations: {
  id: string
  name: string
  location_number: number
 } | null
 user_profiles: {
  id: string
  first_name: string
  last_name: string
 } | null
 itemsCount?: number // Calculated from order_items length
}

// Master product data for order items
export interface MasterProductData {
 id: string
 description: string
 article_code: string
 ean_code: string
 account: string | null
 unit_size: string | null
}

// Supplier data for order items
export interface SupplierData {
 id: string
 name: string
}

// Order item with full product details
export interface OrderItemWithProduct {
 id: string
 quantity: number
 unit_price: number
 total_price: number
 baseline_unit_price: number | null
 override_reason: string | null
 master_products: MasterProductData | null
 supplier_products: {
  id: string
  suppliers: SupplierData | null
 } | null
 savings?: number // Calculated: (baseline_unit_price - unit_price) * quantity
}

// Complete order detail with items
export interface OrderDetail {
 id: string
 order_date: string
 total_amount: number | null
 notes: string | null
 created_at: string | null
 locations: {
  id: string
  name: string
  location_number: number
 } | null
 user_profiles: {
  id: string
  first_name: string
  last_name: string
 } | null
 order_items: OrderItemWithProduct[]
}

// Statistics summary
export interface OrderStats {
 totalOrders: number
 totalAmount: number
 totalSaved: number
 avgOrderValue: number
}

// Company option for dropdown
export interface CompanyOption {
 id: string
 name: string
}

// Location option for dropdown
export interface LocationOption {
 id: string
 name: string
 location_number: number
 company_id?: string
 company_name?: string
}

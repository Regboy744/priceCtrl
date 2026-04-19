import type {
 Tables,
 TablesInsert,
 TablesUpdate,
} from '@/types/shared/database.types'

// Database types
export type LocationSupplierCredential = Tables<'location_supplier_credentials'>
export type LocationSupplierCredentialInsert =
 TablesInsert<'location_supplier_credentials'>
export type LocationSupplierCredentialUpdate =
 TablesUpdate<'location_supplier_credentials'>

// Login status options
export const LOGIN_STATUS_OPTIONS = [
 'success',
 'failed',
 'expired',
 'pending',
] as const
export type LoginStatus = (typeof LOGIN_STATUS_OPTIONS)[number]

// UI types - Supplier with its credential for a location
export interface SupplierWithCredential {
 supplier_id: string
 supplier_name: string
 credential_id: string | null
 username: string | null
 website_url: string | null
 login_url: string | null
 last_login_status: LoginStatus | null
 last_login_at: string | null
 is_active: boolean
}

// Form data for saving credentials
export interface CredentialFormData {
 supplier_id: string
 username: string
 password?: string // Only sent when creating/updating password
 website_url?: string
 login_url?: string
 is_active: boolean
}

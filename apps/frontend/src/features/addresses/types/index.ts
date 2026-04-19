import type {
 Tables,
 TablesInsert,
 TablesUpdate,
} from '@/types/shared/database.types'

// Address types from database
export type Address = Tables<'addresses'>
export type AddressInsert = TablesInsert<'addresses'>
export type AddressUpdate = TablesUpdate<'addresses'>

// Address type options
export const ADDRESS_TYPES = ['headoffice', 'billing', 'warehouse'] as const
export type AddressType = (typeof ADDRESS_TYPES)[number]

// Form data type (used by AddressEditForm)
export interface AddressFormData {
 id?: string
 street_address: string
 address_line2?: string
 city: string
 county: string
 eircode: string
 country: string
 address_type: AddressType
 is_active: boolean
}

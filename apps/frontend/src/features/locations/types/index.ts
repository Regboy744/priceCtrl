import type {
 Tables,
 TablesInsert,
 TablesUpdate,
} from '@/types/shared/database.types'

// Location types from database
export type Location = Tables<'locations'>
export type LocationInsert = TablesInsert<'locations'>
export type LocationUpdate = TablesUpdate<'locations'>

// Location type options
export const LOCATION_TYPES = ['store', 'office'] as const
export type LocationType = (typeof LOCATION_TYPES)[number]

// Form data type (used by LocationEditForm)
export interface LocationFormData {
 id?: string
 name: string
 location_number: number
 location_type: LocationType
 is_active: boolean
}

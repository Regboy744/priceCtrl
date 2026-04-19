import { apiClient } from '@/lib/apiClient'
import type {
 Location,
 LocationInsert,
 LocationUpdate,
} from '@/features/locations/types'

interface MutationResult<T = Location> {
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

// CREATE location
export const createLocation = async (
 location: LocationInsert,
): Promise<MutationResult> => {
 const res = await apiClient.post<Location>('/locations', {
  company_id: location.company_id,
  name: location.name,
  location_number: location.location_number,
  location_type: location.location_type,
  is_active: location.is_active ?? true,
 })
 return toMutationResult(res)
}

// UPDATE location
export const updateLocation = async (
 id: string,
 location: LocationUpdate,
): Promise<MutationResult> => {
 const res = await apiClient.patch<Location>(
  `/locations/${encodeURIComponent(id)}`,
  {
   name: location.name,
   location_number: location.location_number,
   location_type: location.location_type,
   is_active: location.is_active,
  },
 )
 return toMutationResult(res)
}

// DELETE location
export const deleteLocation = async (
 id: string,
): Promise<MutationResult<null>> => {
 const res = await apiClient.delete<null>(
  `/locations/${encodeURIComponent(id)}`,
 )
 return toMutationResult(res)
}

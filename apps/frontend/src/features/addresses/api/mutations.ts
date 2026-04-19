import { apiClient } from '@/lib/apiClient'
import type {
 Address,
 AddressInsert,
 AddressUpdate,
} from '@/features/addresses/types'

interface MutationResult<T = Address> {
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

// CREATE address
export const createAddress = async (
 address: AddressInsert,
): Promise<MutationResult> => {
 const res = await apiClient.post<Address>('/addresses', {
  company_id: address.company_id,
  street_address: address.street_address,
  address_line2: address.address_line2,
  city: address.city,
  county: address.county,
  eircode: address.eircode,
  country: address.country ?? 'Ireland',
  address_type: address.address_type ?? 'headoffice',
  is_active: address.is_active ?? true,
 })
 return toMutationResult(res)
}

// UPDATE address
export const updateAddress = async (
 id: string,
 address: AddressUpdate,
): Promise<MutationResult> => {
 const res = await apiClient.patch<Address>(
  `/addresses/${encodeURIComponent(id)}`,
  {
   street_address: address.street_address,
   address_line2: address.address_line2,
   city: address.city,
   county: address.county,
   eircode: address.eircode,
   country: address.country,
   address_type: address.address_type,
   is_active: address.is_active,
  },
 )
 return toMutationResult(res)
}

// DELETE address
export const deleteAddress = async (
 id: string,
): Promise<MutationResult<null>> => {
 const res = await apiClient.delete<null>(
  `/addresses/${encodeURIComponent(id)}`,
 )
 return toMutationResult(res)
}

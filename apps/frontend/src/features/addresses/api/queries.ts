import { apiClient } from '@/lib/apiClient'
import type { Address } from '@/features/addresses/types'

interface QueryResult<T> {
 data: T | null
 error: Error | null
 status: number
}

const toQueryResult = <T>(res: {
 success: boolean
 data?: T
 error?: { message: string; status: number }
}): QueryResult<T> => ({
 data: res.success ? (res.data ?? null) : null,
 error: res.success ? null : new Error(res.error?.message ?? 'Request failed'),
 status: res.error?.status ?? (res.success ? 200 : 500),
})

// Fetch address by company ID (single address per company, location_id IS NULL)
export const addressByCompanyQuery = async (companyId: string) => {
 const res = await apiClient.get<Address | null>(
  `/addresses/company/${encodeURIComponent(companyId)}`,
 )
 return toQueryResult(res)
}

export type AddressByCompanyType = Address

// Fetch single address by ID
export const addressQuery = async (id: string) => {
 const res = await apiClient.get<Address>(
  `/addresses/${encodeURIComponent(id)}`,
 )
 return toQueryResult(res)
}

export type AddressQueryType = Address

import { apiClient } from '@/lib/apiClient'
import type { Location } from '@/features/locations/types'

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

// Fetch locations by company ID
export const locationsByCompanyQuery = async (companyId: string) => {
 const res = await apiClient.get<Location[]>(
  `/locations?companyId=${encodeURIComponent(companyId)}`,
 )
 return toQueryResult(res)
}

export type LocationsByCompanyType = Location[]

// Fetch single location
export const locationQuery = async (id: string) => {
 const res = await apiClient.get<Location>(`/locations/${encodeURIComponent(id)}`)
 return toQueryResult(res)
}

export type LocationType = Location

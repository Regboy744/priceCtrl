import { apiClient } from '@/lib/apiClient'
import type { Tables } from '@/types/shared/database.types'

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

type CredentialRow = Pick<
 Tables<'location_supplier_credentials'>,
 | 'id'
 | 'location_id'
 | 'company_id'
 | 'supplier_id'
 | 'username'
 | 'website_url'
 | 'login_url'
 | 'last_login_status'
 | 'last_login_at'
 | 'last_error_message'
 | 'is_active'
 | 'created_at'
 | 'updated_at'
> & {
 suppliers: Pick<Tables<'suppliers'>, 'id' | 'name'> | null
}

// Fetch all credentials for a specific location with supplier info
export const locationCredentialsQuery = async (locationId: string) => {
 const res = await apiClient.get<CredentialRow[]>(
  `/location-credentials?locationId=${encodeURIComponent(locationId)}`,
 )
 return toQueryResult(res)
}

export type LocationCredentialsType = CredentialRow[]

type SupplierSummary = Pick<Tables<'suppliers'>, 'id' | 'name' | 'is_active'>

// Fetch all active suppliers for dropdown
export const allSuppliersQuery = async () => {
 const res = await apiClient.get<SupplierSummary[]>(
  '/suppliers?activeOnly=true',
 )
 return toQueryResult(res)
}

export type AllSuppliersType = SupplierSummary[]

// Fetch a single credential by ID
export const credentialByIdQuery = async (credentialId: string) => {
 const res = await apiClient.get<CredentialRow>(
  `/location-credentials/${encodeURIComponent(credentialId)}`,
 )
 return toQueryResult(res)
}

export type CredentialByIdType = CredentialRow

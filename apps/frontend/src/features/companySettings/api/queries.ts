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

type SupplierSummary = Pick<Tables<'suppliers'>, 'id' | 'name' | 'is_active'>

// Fetch all active suppliers
export const allSuppliersQuery = async () => {
 const res = await apiClient.get<SupplierSummary[]>(
  '/suppliers?activeOnly=true',
 )
 return toQueryResult(res)
}

export type AllSuppliersType = SupplierSummary[]

type CompanySupplierSetting = Tables<'company_supplier_settings'>

// Fetch company supplier settings for a specific company
export const companySupplierSettingsQuery = async (companyId: string) => {
 const res = await apiClient.get<CompanySupplierSetting[]>(
  `/company-settings?companyId=${encodeURIComponent(companyId)}`,
 )
 return toQueryResult(res)
}

export type CompanySupplierSettingsType = CompanySupplierSetting[]

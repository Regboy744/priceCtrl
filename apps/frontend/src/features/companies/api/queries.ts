import { apiClient } from '@/lib/apiClient'
import type { CompanyWithBrand } from '@/features/companies/types'
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

// Fetch all companies with brands
export const companiesQuery = async () => {
 const res = await apiClient.get<CompanyWithBrand[]>('/companies')
 return toQueryResult(res)
}

export type CompaniesType = CompanyWithBrand[]

// Fetch a single company with brand
export const companyQuery = async (id: string) => {
 const res = await apiClient.get<CompanyWithBrand>(
  `/companies/${encodeURIComponent(id)}`,
 )
 return toQueryResult(res)
}

export type CompanyType = CompanyWithBrand

type BrandSummary = Pick<Tables<'brands'>, 'id' | 'name'>

// Fetch all brands for dropdown
export const brandsQuery = async () => {
 const res = await apiClient.get<BrandSummary[]>('/brands?activeOnly=true')
 return toQueryResult(res)
}

export type BrandsType = BrandSummary[]

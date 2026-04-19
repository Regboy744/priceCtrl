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

type MasterProductWithBrand = Tables<'master_products'> & {
 brands: Pick<Tables<'brands'>, 'name'> | null
}

// Query all master products with brand name
export const masterProductsQuery = async () => {
 const res = await apiClient.get<MasterProductWithBrand[]>('/master-products')
 return toQueryResult(res)
}

export type MasterProductsQueryType = MasterProductWithBrand[]

// Query master products by brand
export const masterProductsByBrandQuery = async (brandId: string) => {
 const res = await apiClient.get<MasterProductWithBrand[]>(
  `/master-products?brandId=${encodeURIComponent(brandId)}`,
 )
 return toQueryResult(res)
}

export type MasterProductsByBrandQueryType = MasterProductWithBrand[]

// Query single master product
export const masterProductQuery = async (id: string) => {
 const res = await apiClient.get<MasterProductWithBrand>(
  `/master-products/${encodeURIComponent(id)}`,
 )
 return toQueryResult(res)
}

export type MasterProductQueryType = MasterProductWithBrand

type BrandSummary = Pick<Tables<'brands'>, 'id' | 'name' | 'is_active'>

// Query all brands for dropdown
export const brandsQuery = async () => {
 const res = await apiClient.get<BrandSummary[]>('/brands?activeOnly=true')
 return toQueryResult(res)
}

export type BrandsQueryType = BrandSummary[]

// Filter options for master products query
export interface MasterProductsFilterOptions {
 brandId?: string | null
 articleCode?: string | null
 eanCode?: string | null
 description?: string | null
 limit?: number
}

// Query master products with optional filters (server-side filtering)
export const masterProductsFilteredQuery = async (
 filters?: MasterProductsFilterOptions,
) => {
 const params = new URLSearchParams()
 params.set('limit', String(filters?.limit ?? 100))
 if (filters?.brandId) params.set('brandId', filters.brandId)
 if (filters?.articleCode) params.set('articleCode', filters.articleCode)
 if (filters?.eanCode) params.set('eanCode', filters.eanCode)
 if (filters?.description) params.set('description', filters.description)

 const res = await apiClient.get<MasterProductWithBrand[]>(
  `/master-products?${params.toString()}`,
 )
 return toQueryResult(res)
}

export type MasterProductsFilteredQueryType = MasterProductWithBrand[]

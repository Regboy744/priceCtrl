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

type CompanySummary = Pick<Tables<'companies'>, 'id' | 'name'>

export const dashboardCompaniesQuery = async () => {
 const res = await apiClient.get<CompanySummary[]>('/companies?activeOnly=true')
 return toQueryResult(res)
}

export type DashboardCompaniesType = CompanySummary[]

type LocationSummary = Pick<
 Tables<'locations'>,
 'id' | 'name' | 'location_number'
>

export const dashboardLocationsQuery = async (companyId: string) => {
 const res = await apiClient.get<LocationSummary[]>(
  `/locations?companyId=${encodeURIComponent(companyId)}&activeOnly=true`,
 )
 return toQueryResult(res)
}

export type DashboardLocationsType = LocationSummary[]

export interface DashboardOrdersQueryParams {
 companyId: string
 locationId?: string | null
 dateFrom?: string | null
 dateTo?: string | null
}

type DashboardOrderRow = Pick<
 Tables<'orders'>,
 'id' | 'order_date' | 'total_amount' | 'location_id'
> & {
 locations: Pick<Tables<'locations'>, 'company_id'> | null
}

export const dashboardOrdersQuery = async (
 params: DashboardOrdersQueryParams,
) => {
 const qs = new URLSearchParams()
 qs.set('shape', 'dashboard')
 qs.set('companyId', params.companyId)
 if (params.locationId) qs.set('locationId', params.locationId)
 if (params.dateFrom) qs.set('dateFrom', params.dateFrom)
 if (params.dateTo) qs.set('dateTo', params.dateTo)

 const res = await apiClient.get<DashboardOrderRow[]>(
  `/orders?${qs.toString()}`,
 )
 return toQueryResult(res)
}

export type DashboardOrdersType = DashboardOrderRow[]

type DashboardOrderItem = Pick<
 Tables<'order_items'>,
 | 'id'
 | 'order_id'
 | 'master_product_id'
 | 'quantity'
 | 'unit_price'
 | 'total_price'
 | 'baseline_unit_price'
 | 'override_reason'
> & {
 master_products: Pick<
  Tables<'master_products'>,
  'id' | 'description' | 'article_code' | 'unit_size'
 > | null
 supplier_products:
  | (Pick<Tables<'supplier_products'>, 'supplier_id'> & {
     suppliers: Pick<Tables<'suppliers'>, 'id' | 'name'> | null
    })
  | null
}

export const dashboardOrderItemsQuery = async (orderIds: string[]) => {
 if (orderIds.length === 0) {
  return toQueryResult({ success: true, data: [] as DashboardOrderItem[] })
 }
 const res = await apiClient.get<DashboardOrderItem[]>(
  `/orders/items-for-dashboard?orderIds=${encodeURIComponent(orderIds.join(','))}`,
 )
 return toQueryResult(res)
}

export type DashboardOrderItemsType = DashboardOrderItem[]

type SavingsRow = Pick<
 Tables<'savings_calculations'>,
 | 'id'
 | 'company_id'
 | 'order_item_id'
 | 'baseline_price'
 | 'chosen_price'
 | 'best_external_price'
 | 'delta_vs_baseline'
 | 'is_saving'
 | 'savings_percentage'
> & {
 order_items: Pick<Tables<'order_items'>, 'order_id'> | null
}

export const dashboardSavingsCalculationsQuery = async (
 companyId: string,
 orderIds: string[],
) => {
 if (orderIds.length === 0) {
  return toQueryResult({ success: true, data: [] as SavingsRow[] })
 }
 const params = new URLSearchParams()
 params.set('companyId', companyId)
 params.set('orderIds', orderIds.join(','))

 const res = await apiClient.get<SavingsRow[]>(
  `/orders/savings?${params.toString()}`,
 )
 return toQueryResult(res)
}

export type DashboardSavingsCalculationsType = SavingsRow[]

type CredentialHealthRow = Pick<
 Tables<'location_supplier_credentials'>,
 | 'id'
 | 'location_id'
 | 'company_id'
 | 'supplier_id'
 | 'last_login_status'
 | 'last_login_at'
 | 'last_error_message'
 | 'is_active'
> & {
 locations: Pick<
  Tables<'locations'>,
  'id' | 'name' | 'location_number'
 > | null
 companies: Pick<Tables<'companies'>, 'id' | 'name'> | null
 suppliers: Pick<Tables<'suppliers'>, 'id' | 'name'> | null
}

export const dashboardCredentialHealthQuery = async (
 companyId: string,
 locationId?: string | null,
) => {
 const params = new URLSearchParams()
 params.set('companyId', companyId)
 if (locationId) params.set('locationId', locationId)

 const res = await apiClient.get<CredentialHealthRow[]>(
  `/location-credentials/health?${params.toString()}`,
 )
 return toQueryResult(res)
}

export type DashboardCredentialHealthType = CredentialHealthRow[]

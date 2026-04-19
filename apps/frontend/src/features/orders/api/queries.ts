import { apiClient } from '@/lib/apiClient'
import type { OrderFilters } from '@/features/orders/types'
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

// ───────────────────────────── companies + locations dropdowns

type CompanySummary = Pick<Tables<'companies'>, 'id' | 'name'>

export const companiesQuery = async () => {
 const res = await apiClient.get<CompanySummary[]>('/companies?activeOnly=true')
 return toQueryResult(res)
}

export type CompaniesQueryType = CompanySummary[]

type LocationSummary = Pick<
 Tables<'locations'>,
 'id' | 'name' | 'location_number'
>

export const locationsByCompanyQuery = async (companyId: string) => {
 const res = await apiClient.get<LocationSummary[]>(
  `/locations?companyId=${encodeURIComponent(companyId)}&activeOnly=true`,
 )
 return toQueryResult(res)
}

export type LocationsByCompanyQueryType = LocationSummary[]

type LocationWithCompany = Pick<
 Tables<'locations'>,
 'id' | 'name' | 'location_number' | 'company_id'
> & {
 company: Pick<Tables<'companies'>, 'id' | 'name'> | null
}

export const locationsWithCompanyQuery = async (
 companyId?: string | null,
) => {
 const params = new URLSearchParams()
 params.set('withCompany', 'true')
 params.set('activeOnly', 'true')
 if (companyId) params.set('companyId', companyId)

 const res = await apiClient.get<LocationWithCompany[]>(
  `/locations?${params.toString()}`,
 )
 return toQueryResult(res)
}

export type LocationsWithCompanyQueryType = LocationWithCompany[]

export const locationByIdWithCompanyQuery = async (locationId: string) => {
 const res = await apiClient.get<LocationWithCompany>(
  `/locations/${encodeURIComponent(locationId)}`,
 )
 return toQueryResult(res)
}

// ───────────────────────────── orders

type OrderListRow = Pick<
 Tables<'orders'>,
 'id' | 'order_date' | 'total_amount' | 'notes' | 'created_at'
> & {
 locations: Pick<
  Tables<'locations'>,
  'id' | 'name' | 'location_number' | 'company_id'
 > | null
 user_profiles: Pick<
  Tables<'user_profiles'>,
  'id' | 'first_name' | 'last_name'
 > | null
}

export const ordersQuery = async (filters: OrderFilters) => {
 const params = new URLSearchParams()
 if (filters.locationId) params.set('locationId', filters.locationId)
 if (filters.companyId) params.set('companyId', filters.companyId)
 if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
 if (filters.dateTo) params.set('dateTo', filters.dateTo)

 const qs = params.toString()
 const res = await apiClient.get<OrderListRow[]>(
  qs ? `/orders?${qs}` : '/orders',
 )
 return toQueryResult(res)
}

export type OrdersQueryType = OrderListRow[]

type OrderDetailRow = Pick<
 Tables<'orders'>,
 'id' | 'order_date' | 'total_amount' | 'notes' | 'created_at'
> & {
 locations: Pick<
  Tables<'locations'>,
  'id' | 'name' | 'location_number'
 > | null
 user_profiles: Pick<
  Tables<'user_profiles'>,
  'id' | 'first_name' | 'last_name'
 > | null
 order_items: Array<
  Pick<
   Tables<'order_items'>,
   | 'id'
   | 'quantity'
   | 'unit_price'
   | 'total_price'
   | 'baseline_unit_price'
   | 'override_reason'
  > & {
   master_products: Pick<
    Tables<'master_products'>,
    'id' | 'description' | 'article_code' | 'ean_code' | 'account' | 'unit_size'
   > | null
   supplier_products:
    | (Pick<Tables<'supplier_products'>, 'id'> & {
       suppliers: Pick<Tables<'suppliers'>, 'id' | 'name'> | null
      })
    | null
  }
 >
}

export const orderDetailQuery = async (orderId: string) => {
 const res = await apiClient.get<OrderDetailRow>(
  `/orders/${encodeURIComponent(orderId)}`,
 )
 return toQueryResult(res)
}

export type OrderDetailQueryType = OrderDetailRow

// ───────────────────────────── stats / counts

type OrderIdRef = Pick<Tables<'order_items'>, 'order_id'>

export const orderItemsCountQuery = async (orderIds: string[]) => {
 if (orderIds.length === 0) {
  return toQueryResult({ success: true, data: [] as OrderIdRef[] })
 }
 const res = await apiClient.get<OrderIdRef[]>(
  `/orders/items-count?orderIds=${encodeURIComponent(orderIds.join(','))}`,
 )
 return toQueryResult(res)
}

export type OrderItemsCountQueryType = OrderIdRef[]

type OrderItemStats = Pick<
 Tables<'order_items'>,
 'id' | 'order_id' | 'quantity'
>

export const orderItemsForStatsQuery = async (orderIds: string[]) => {
 if (orderIds.length === 0) {
  return toQueryResult({ success: true, data: [] as OrderItemStats[] })
 }
 const res = await apiClient.get<OrderItemStats[]>(
  `/orders/items-for-stats?orderIds=${encodeURIComponent(orderIds.join(','))}`,
 )
 return toQueryResult(res)
}

export type OrderItemsForStatsQueryType = OrderItemStats[]

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

export const orderSavingsCalculationsQuery = async (
 companyId: string | null,
 orderIds: string[],
) => {
 if (orderIds.length === 0) {
  return toQueryResult({ success: true, data: [] as SavingsRow[] })
 }
 const params = new URLSearchParams()
 params.set('orderIds', orderIds.join(','))
 if (companyId) params.set('companyId', companyId)

 const res = await apiClient.get<SavingsRow[]>(
  `/orders/savings?${params.toString()}`,
 )
 return toQueryResult(res)
}

export type OrderSavingsCalculationsQueryType = SavingsRow[]

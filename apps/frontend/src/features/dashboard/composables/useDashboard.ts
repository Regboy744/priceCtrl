import { computed, onMounted, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'
import { useErrorStore } from '@/stores/error'
import { useWarningsStore } from '@/stores/warnings'
import { getPresetDateRange, type DatePreset } from '@/lib/utils/datePresets'
import {
 dashboardCompaniesQuery,
 dashboardCredentialHealthQuery,
 dashboardLocationsQuery,
 dashboardOrderItemsQuery,
 dashboardOrdersQuery,
 dashboardSavingsCalculationsQuery,
 type DashboardCredentialHealthType,
 type DashboardOrderItemsType,
 type DashboardOrdersType,
 type DashboardSavingsCalculationsType,
} from '@/features/dashboard/api/queries'
import type {
 CompanyOption,
 CredentialIssueRow,
 CredentialLoginStatus,
 DashboardAlerts,
 DashboardFilters,
 DashboardKpis,
 LocationOption,
 SupplierSummaryRow,
 TopProductRow,
} from '@/features/dashboard/types'

function emptyKpis(): DashboardKpis {
 return {
  ordersCount: 0,
  spendTotal: 0,
  avgOrderValue: 0,
  savedTotal: 0,
  overspendTotal: 0,
  savingsRate: 0,
 }
}

function emptyAlerts(): DashboardAlerts {
 return {
  credentialIssues: [],
 }
}

function normalizeLoginStatus(status: string | null): CredentialLoginStatus {
 if (status === 'success') return 'success'
 if (status === 'failed') return 'failed'
 if (status === 'expired') return 'expired'
 if (status === 'pending') return 'pending'
 return 'unknown'
}

export const useDashboard = () => {
 const authStore = useAuthStore()
 const errorStore = useErrorStore()
 const warningsStore = useWarningsStore()

 const companies = ref<CompanyOption[]>([])
 const locations = ref<LocationOption[]>([])

 const isLoadingCompanies = ref(false)
 const isLoadingLocations = ref(false)
 const isLoadingDashboard = ref(false)

 const filters = ref<DashboardFilters>({
  companyId: null,
  locationId: null,
  dateFrom: null,
  dateTo: null,
  datePreset: 'month',
 })

 const kpis = ref<DashboardKpis>(emptyKpis())
 const topProductsByUnits = ref<TopProductRow[]>([])
 const topProductsBySpend = ref<TopProductRow[]>([])
 const supplierSummary = ref<SupplierSummaryRow[]>([])
 const alerts = ref<DashboardAlerts>(emptyAlerts())

 const role = computed(() => authStore.userRole)

 const effectiveCompanyId = computed(() => {
  if (role.value === 'master') return filters.value.companyId
  return authStore.companyId
 })

 const effectiveLocationId = computed(() => {
  if (role.value === 'manager') return authStore.locationId
  return filters.value.locationId
 })

 const dateError = computed(() => {
  if (filters.value.datePreset !== 'custom') return null

  const { dateFrom, dateTo } = filters.value
  if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
   return 'Both From and To dates are required'
  }

  if (dateFrom && dateTo) {
   const from = new Date(dateFrom)
   const to = new Date(dateTo)
   if (from > to) {
    return 'From date cannot be after To date'
   }
  }

  return null
 })

 const isScopeReady = computed(() => {
  if (!effectiveCompanyId.value) return false
  return !dateError.value
 })

 const showNoCompanyMessage = computed(() => {
  return (
   (role.value === 'admin' || role.value === 'manager') && !authStore.companyId
  )
 })

 const showEmptyPeriodMessage = computed(() => {
  return (
   isScopeReady.value &&
   !isLoadingDashboard.value &&
   kpis.value.ordersCount === 0
  )
 })

 const showSelectCompanyMessage = computed(() => {
  return role.value === 'master' && !filters.value.companyId
 })

 const applyDatePreset = (preset: DatePreset) => {
  const range = getPresetDateRange(preset)
  filters.value = {
   ...filters.value,
   datePreset: preset,
   dateFrom: range.dateFrom,
   dateTo: range.dateTo,
  }
 }

 const resetDashboard = () => {
  kpis.value = emptyKpis()
  topProductsByUnits.value = []
  topProductsBySpend.value = []
  supplierSummary.value = []
  warningsStore.clear()
 }

 const clearAlerts = () => {
  alerts.value = emptyAlerts()
  warningsStore.clear()
 }

 const fetchCompanies = async () => {
  isLoadingCompanies.value = true
  try {
   const { data, error, status } = await dashboardCompaniesQuery()
   if (error) {
    errorStore.setError({ error, customCode: status })
    return null
   }
   companies.value = (data ?? []).map((c) => ({ id: c.id, name: c.name }))
   return companies.value
  } finally {
   isLoadingCompanies.value = false
  }
 }

 const fetchLocations = async (companyId: string) => {
  isLoadingLocations.value = true
  try {
   const { data, error, status } = await dashboardLocationsQuery(companyId)
   if (error) {
    errorStore.setError({ error, customCode: status })
    return null
   }
   locations.value = (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    location_number: l.location_number,
   }))
   return locations.value
  } finally {
   isLoadingLocations.value = false
  }
 }

 const updateFilters = (patch: Partial<DashboardFilters>) => {
  filters.value = {
   ...filters.value,
   ...patch,
  }
 }

 const resetFilters = () => {
  const range = getPresetDateRange('month')
  filters.value = {
   companyId: role.value === 'master' ? null : filters.value.companyId,
   locationId: null,
   datePreset: 'month',
   dateFrom: range.dateFrom,
   dateTo: range.dateTo,
  }
 }

 const refreshDashboard = async () => {
  if (!isScopeReady.value) {
   resetDashboard()
   clearAlerts()
   return
  }

  const companyId = effectiveCompanyId.value
  if (!companyId) {
   resetDashboard()
   clearAlerts()
   return
  }

  isLoadingDashboard.value = true

  try {
   const credentialPromise = dashboardCredentialHealthQuery(
    companyId,
    effectiveLocationId.value,
   )

   const {
    data: ordersData,
    error: ordersError,
    status: ordersStatus,
   } = await dashboardOrdersQuery({
    companyId,
    locationId: effectiveLocationId.value,
    dateFrom: filters.value.dateFrom,
    dateTo: filters.value.dateTo,
   })

   if (ordersError) {
    errorStore.setError({ error: ordersError, customCode: ordersStatus })
    resetDashboard()
    clearAlerts()
    return
   }

   const orders = (ordersData ?? []) as DashboardOrdersType
   const orderIds = orders.map((o) => o.id)
   const ordersCount = orderIds.length
   const spendTotal = orders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
   const avgOrderValue = ordersCount > 0 ? spendTotal / ordersCount : 0

   const {
    data: itemsData,
    error: itemsError,
    status: itemsStatus,
   } = await dashboardOrderItemsQuery(orderIds)

   if (itemsError) {
    errorStore.setError({ error: itemsError, customCode: itemsStatus })
    resetDashboard()
    clearAlerts()
    return
   }

    const orderItems = (itemsData ?? []) as DashboardOrderItemsType

    const {
     data: savingsData,
     error: savingsError,
     status: savingsStatus,
    } = await dashboardSavingsCalculationsQuery(companyId, orderIds)

   if (savingsError) {
    errorStore.setError({ error: savingsError, customCode: savingsStatus })
    resetDashboard()
    clearAlerts()
    return
   }

   const savings = (savingsData ?? []) as DashboardSavingsCalculationsType

   const [credentialRes] = await Promise.all([credentialPromise])

   const credentialData = (credentialRes.data ??
    []) as DashboardCredentialHealthType
   const credentialIssues: CredentialIssueRow[] = credentialData
    .map((c) => {
     const supplierName =
      (c.suppliers as { name?: string } | null)?.name ?? 'Unknown supplier'
     const companyName =
      (c.companies as { name?: string } | null)?.name ?? 'Unknown company'
     const locationName =
      (c.locations as { name?: string } | null)?.name ?? 'Unknown location'
     const locationNumber =
      (c.locations as { location_number?: number } | null)?.location_number ??
      null

     return {
      id: c.id,
      supplierName,
      companyName,
      locationName,
      locationNumber,
      status: normalizeLoginStatus(c.last_login_status),
      lastLoginAt: c.last_login_at,
      lastErrorMessage: c.last_error_message,
     }
    })
    .filter((c) => c.status === 'failed' || c.status === 'expired')

   if (credentialRes.error) {
    errorStore.setError({
     error: credentialRes.error,
     customCode: credentialRes.status,
    })
   }

   alerts.value = {
    credentialIssues,
   }
   warningsStore.setCredentialIssues(credentialIssues)

   // Map order IDs to dates for per-product latest ordering
   const orderDateById = new Map<string, string>()
   for (const o of orders) {
    orderDateById.set(o.id, o.order_date)
   }

   // Map order item ID to quantity
   const quantityByOrderItemId = new Map<string, number>()
   for (const item of orderItems) {
    quantityByOrderItemId.set(item.id, item.quantity)
   }

   let savedTotal = 0
   let overspendTotal = 0
   let baselineTotal = 0

   for (const s of savings) {
    const delta = s.delta_vs_baseline ?? 0
    if (delta < 0) {
     savedTotal += -delta
    } else if (delta > 0) {
     overspendTotal += delta
    }

    const qty = quantityByOrderItemId.get(s.order_item_id) ?? 0
    baselineTotal += (s.baseline_price ?? 0) * qty
   }

   const savingsRate = baselineTotal > 0 ? savedTotal / baselineTotal : 0

   // Top products
   const aggregated = new Map<string, TopProductRow>()
   for (const item of orderItems) {
    const existing = aggregated.get(item.master_product_id)
    const product = item.master_products as {
     description: string
     article_code: string
     unit_size: string | null
    } | null

    const orderDate = orderDateById.get(item.order_id) ?? null
    const description = product?.description ?? 'Unknown product'
    const articleCode = product?.article_code ?? '-'
    const unitSize = product?.unit_size ?? null

    if (!existing) {
     aggregated.set(item.master_product_id, {
      master_product_id: item.master_product_id,
      description,
      article_code: articleCode,
      unit_size: unitSize,
      quantity: item.quantity,
      spend: item.total_price,
      lastOrderDate: orderDate,
     })
     continue
    }

    existing.quantity += item.quantity
    existing.spend += item.total_price
    if (
     orderDate &&
     (!existing.lastOrderDate || orderDate > existing.lastOrderDate)
    ) {
     existing.lastOrderDate = orderDate
    }
   }

   const rows = Array.from(aggregated.values())
   topProductsByUnits.value = [...rows]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)
   topProductsBySpend.value = [...rows]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10)

   // Per-supplier aggregation
   const supplierAgg = new Map<
    string,
    {
     supplierName: string
     orderIds: Set<string>
     spendTotal: number
     savedTotal: number
    }
   >()

   // Build savings lookup by order_item_id
   const savingsByItemId = new Map<string, number>()
   for (const s of savings) {
    const delta = s.delta_vs_baseline ?? 0
    if (delta < 0) {
     savingsByItemId.set(s.order_item_id, -delta)
    }
   }

   for (const item of orderItems) {
    const supplierProduct = item.supplier_products as {
     supplier_id: string
     suppliers: { id: string; name: string } | null
    } | null

    const supplierId = supplierProduct?.supplier_id
    const supplierName = supplierProduct?.suppliers?.name ?? 'Unknown supplier'

    if (!supplierId) continue

    const existing = supplierAgg.get(supplierId)
    const itemSaved = savingsByItemId.get(item.id) ?? 0

    if (!existing) {
     supplierAgg.set(supplierId, {
      supplierName,
      orderIds: new Set([item.order_id]),
      spendTotal: item.total_price,
      savedTotal: itemSaved,
     })
    } else {
     existing.orderIds.add(item.order_id)
     existing.spendTotal += item.total_price
     existing.savedTotal += itemSaved
    }
   }

   supplierSummary.value = Array.from(supplierAgg.entries())
    .map(([id, agg]) => ({
     supplierId: id,
     supplierName: agg.supplierName,
     ordersCount: agg.orderIds.size,
     spendTotal: agg.spendTotal,
     savedTotal: agg.savedTotal,
    }))
    .sort((a, b) => b.spendTotal - a.spendTotal)
    .slice(0, 8)

   kpis.value = {
    ordersCount,
    spendTotal,
    avgOrderValue,
    savedTotal,
    overspendTotal,
    savingsRate,
   }
  } finally {
   isLoadingDashboard.value = false
  }
 }

 const debouncedRefresh = useDebounceFn(refreshDashboard, 250)

 // Defaults: this month + role-specific initial location
 onMounted(() => {
  applyDatePreset('month')
 })

 watch(
  () => role.value,
  (newRole) => {
   if (!newRole) return
   if (newRole === 'master') {
    fetchCompanies()
    locations.value = []
    filters.value.locationId = null
    return
   }

   // Admin/manager: company is derived from auth store, but location may be
   // pre-selected to the user's location for convenience.
   if (newRole === 'admin') {
    filters.value.locationId = null
   }
  },
  { immediate: true },
 )

 watch(
  () => filters.value.companyId,
  (companyId) => {
   if (role.value !== 'master') return
   filters.value.locationId = null
   locations.value = []
   if (companyId) {
    fetchLocations(companyId)
   }
  },
 )

 watch(
  () => authStore.companyId,
  (companyId) => {
   if (!companyId) return
   if (role.value === 'admin') {
    fetchLocations(companyId)
   }
  },
  { immediate: true },
 )

 watch(
  () => [
   role.value,
   effectiveCompanyId.value,
   effectiveLocationId.value,
   filters.value.dateFrom,
   filters.value.dateTo,
   filters.value.datePreset,
   dateError.value,
  ],
  () => {
   debouncedRefresh()
  },
  { immediate: true },
 )

 return {
  // State
  role,
  companies,
  locations,
  filters,
  kpis,
  topProductsByUnits,
  topProductsBySpend,
  supplierSummary,
  alerts,
  dateError,
  showSelectCompanyMessage,
  showNoCompanyMessage,
  showEmptyPeriodMessage,

  // Loading
  isLoadingCompanies,
  isLoadingLocations,
  isLoadingDashboard,

  // Actions
  updateFilters,
  resetFilters,
  applyDatePreset,
  refreshDashboard,
 }
}

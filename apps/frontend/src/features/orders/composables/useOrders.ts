import { ref, computed } from 'vue'
import { useErrorStore } from '@/stores/error'
import {
 ordersQuery,
 orderDetailQuery,
 orderItemsForStatsQuery,
 orderSavingsCalculationsQuery,
 locationsWithCompanyQuery,
 locationByIdWithCompanyQuery,
} from '@/features/orders/api/queries'
import type {
 OrderFilters,
 OrderStats,
 OrderWithLocation,
 OrderDetail,
 OrderItemWithProduct,
 LocationOption,
} from '@/features/orders/types'
import { useAuthStore } from '@/stores/auth'

export const useOrders = () => {
 const errorStore = useErrorStore()
 const authStore = useAuthStore()

 // State
 const locations = ref<LocationOption[]>([])
 const locationsByCompany = ref<Map<string, LocationOption[]>>(new Map())
 const orders = ref<OrderWithLocation[]>([])
 const orderDetail = ref<OrderDetail | null>(null)
 const isLoading = ref(false)
 const isLoadingLocations = ref(false)
 const isLoadingDetail = ref(false)
 const totalSaved = ref(0)

 // Filters
 const filters = ref<OrderFilters>({
  companyId: null,
  locationId: null,
  dateFrom: null,
  dateTo: null,
  datePreset: undefined,
 })

 // Statistics
 const orderStats = computed<OrderStats>(() => {
  const totalOrders = orders.value.length
  const totalAmount = orders.value.reduce(
   (sum, order) => sum + (order.total_amount || 0),
   0,
  )

  const avgOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0

  return {
   totalOrders,
   totalAmount,
   totalSaved: totalSaved.value,
   avgOrderValue,
  }
 })

 const applyRoleDefaults = () => {
  const role = authStore.userRole

  if (role === 'manager') {
   filters.value.companyId = authStore.companyId
   filters.value.locationId = authStore.locationId
   return
  }

  if (role === 'admin') {
   filters.value.companyId = authStore.companyId
   filters.value.locationId = null
   return
  }

  filters.value.companyId = null
  filters.value.locationId = null
 }

 const mapLocation = (row: {
  id: string
  name: string
  location_number: number
  company_id: string
  company?: { id: string; name: string } | null
 }): LocationOption => {
  return {
   id: row.id,
   name: row.name,
   location_number: row.location_number,
   company_id: row.company_id,
   company_name: row.company?.name || 'Unknown company',
  }
 }

 // Load locations based on role
 const loadLocations = async () => {
  isLoadingLocations.value = true
  locations.value = []
  locationsByCompany.value = new Map()

  try {
   const role = authStore.userRole

   if (role === 'manager') {
    if (!authStore.locationId) {
     errorStore.setError({
      error: 'Your account is not linked to a location.',
      customCode: 403,
     })
     return
    }

    const { data, error, status } = await locationByIdWithCompanyQuery(
     authStore.locationId,
    )

    if (error) {
     errorStore.setError({ error, customCode: status })
     return
    }

    if (data) {
     const location = mapLocation(data)
     locations.value = [location]
     if (!filters.value.locationId) {
      filters.value.locationId = location.id
     }
     if (!filters.value.companyId) {
      filters.value.companyId = location.company_id ?? null
     }
    }

    return
   }

   if (role === 'admin') {
    if (!authStore.companyId) {
     errorStore.setError({
      error: 'Your account is not linked to a company.',
      customCode: 403,
     })
     return
    }

    const { data, error, status } = await locationsWithCompanyQuery(
     authStore.companyId,
    )

    if (error) {
     errorStore.setError({ error, customCode: status })
     return
    }

    locations.value = (data ?? []).map(mapLocation)
    return
   }

   const { data, error, status } = await locationsWithCompanyQuery()

   if (error) {
    errorStore.setError({ error, customCode: status })
    return
   }

   const grouped = new Map<string, LocationOption[]>()

   for (const row of data ?? []) {
    const location = mapLocation(row)
    const companyName = location.company_name || 'Unknown company'
    const list = grouped.get(companyName) || []
    list.push(location)
    grouped.set(companyName, list)
    locations.value.push(location)
   }

   locationsByCompany.value = grouped
  } finally {
   isLoadingLocations.value = false
  }
 }

 // Validate date range before fetching
 const isDateRangeValid = (): boolean => {
  // If custom preset is selected, both dates must be provided and valid
  if (filters.value.datePreset === 'custom') {
   const { dateFrom, dateTo } = filters.value

   // Both dates required
   if (!dateFrom || !dateTo) {
    return false
   }

   // From must not be after To
   const fromDate = new Date(dateFrom)
   const toDate = new Date(dateTo)

   if (fromDate > toDate) {
    return false
   }
  }

  return true
 }

 // Fetch orders with current filters
 const fetchOrders = async () => {
  if (authStore.userRole === 'manager' && !filters.value.locationId) {
   orders.value = []
   totalSaved.value = 0
   return []
  }

  // Don't fetch if date range is invalid
  if (!isDateRangeValid()) {
   orders.value = []
   totalSaved.value = 0
   return []
  }

  isLoading.value = true
  try {
   const { data, error, status } = await ordersQuery(filters.value)

   if (error) {
    errorStore.setError({ error, customCode: status })
    totalSaved.value = 0
    return null
   }

   const ordersData = data ?? []
   const orderIds = ordersData.map((order) => order.id)
   totalSaved.value = 0

   if (orderIds.length === 0) {
    orders.value = ordersData
    return ordersData
   }

   const {
    data: itemsData,
    error: itemsError,
    status: itemsStatus,
   } = await orderItemsForStatsQuery(orderIds)

   if (itemsError) {
    errorStore.setError({ error: itemsError, customCode: itemsStatus })
   }

   const items = itemsData ?? []

   // Count items per order
   const itemCounts = items.reduce(
    (acc, item) => {
     acc[item.order_id] = (acc[item.order_id] || 0) + 1
     return acc
    },
    {} as Record<string, number>,
   )

   // Add item counts to orders
   const ordersWithCounts = ordersData.map((order) => ({
    ...order,
    itemsCount: itemCounts[order.id] || 0,
   }))

   orders.value = ordersWithCounts

    if (orderIds.length > 0) {
     const {
      data: savingsData,
      error: savingsError,
      status: savingsStatus,
     } = await orderSavingsCalculationsQuery(
      filters.value.companyId,
      orderIds,
     )

    if (savingsError) {
     errorStore.setError({ error: savingsError, customCode: savingsStatus })
    } else {
     const savings = savingsData ?? []
     totalSaved.value = savings.reduce((sum, item) => {
      const delta = item.delta_vs_baseline ?? 0
      if (delta < 0) return sum + -delta
      return sum
     }, 0)
    }
   }

   return ordersWithCounts
  } finally {
   isLoading.value = false
  }
 }

 // Fetch single order detail
 const fetchOrderDetail = async (orderId: string) => {
  isLoadingDetail.value = true
  try {
   const { data, error, status } = await orderDetailQuery(orderId)

   if (error) {
    errorStore.setError({ error, customCode: status })
    return null
   }

   // Calculate savings for each item
   if (data?.order_items) {
    const itemsWithSavings = data.order_items.map((item) => {
     const savings =
      item.baseline_unit_price && item.unit_price
       ? (item.baseline_unit_price - item.unit_price) * item.quantity
       : 0
     return {
      ...item,
      savings,
     }
    })

    orderDetail.value = {
     ...data,
     order_items: itemsWithSavings as OrderItemWithProduct[],
    }
   } else {
    orderDetail.value = data as OrderDetail
   }

   return orderDetail.value
  } finally {
   isLoadingDetail.value = false
  }
 }

 // Update filters
 const updateFilters = async (newFilters: Partial<OrderFilters>) => {
  filters.value = {
   ...filters.value,
   ...newFilters,
  }

  // If location changed, derive company context
  if (newFilters.locationId !== undefined) {
   if (newFilters.locationId) {
    const location = locations.value.find(
     (item) => item.id === newFilters.locationId,
    )
    if (location?.company_id) {
     filters.value.companyId = location.company_id
    }
   } else {
    if (authStore.userRole === 'admin') {
     filters.value.companyId = authStore.companyId
    } else if (authStore.userRole === 'master') {
     filters.value.companyId = null
    }
   }
  }

  // Fetch orders with new filters
  await fetchOrders()
 }

 // Reset filters
 const resetFilters = () => {
  filters.value = {
   companyId: filters.value.companyId,
   locationId: filters.value.locationId,
   dateFrom: null,
   dateTo: null,
   datePreset: undefined,
  }
  applyRoleDefaults()
  orders.value = []
  totalSaved.value = 0
 }

 // Apply date preset
 const applyDatePreset = async (preset: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let dateFrom: Date | null = null
  let dateTo: Date | null = null

  switch (preset) {
   case 'today':
    dateFrom = new Date(today)
    dateTo = new Date(today)
    dateTo.setHours(23, 59, 59, 999)
    break
   case 'week':
    dateFrom = new Date(today)
    dateFrom.setDate(today.getDate() - today.getDay()) // Start of week
    dateTo = new Date(today)
    dateTo.setDate(dateFrom.getDate() + 6) // End of week
    dateTo.setHours(23, 59, 59, 999)
    break
   case 'month':
    dateFrom = new Date(today.getFullYear(), today.getMonth(), 1)
    dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    dateTo.setHours(23, 59, 59, 999)
    break
   case 'lastMonth':
    dateFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    dateTo = new Date(today.getFullYear(), today.getMonth(), 0)
    dateTo.setHours(23, 59, 59, 999)
    break
   case 'custom':
    // Clear dates when switching to custom (user will set manually)
    dateFrom = null
    dateTo = null
    break
  }

  await updateFilters({
   dateFrom: dateFrom?.toISOString().split('T')[0] || null,
   dateTo: dateTo?.toISOString().split('T')[0] || null,
   datePreset: preset as 'today' | 'week' | 'month' | 'lastMonth' | 'custom',
  })
 }

 const initialize = async () => {
  applyRoleDefaults()
  await loadLocations()
  await fetchOrders()
 }

 return {
  // State
  locations,
  locationsByCompany,
  orders,
  orderDetail,
  filters,
  orderStats,
  isLoading,
  isLoadingLocations,
  isLoadingDetail,

  // Methods
  loadLocations,
  fetchOrders,
  fetchOrderDetail,
  updateFilters,
  resetFilters,
  applyDatePreset,
  initialize,

  // Validation
  isDateRangeValid,
 }
}

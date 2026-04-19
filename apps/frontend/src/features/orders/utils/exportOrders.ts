import Papa from 'papaparse'
import type { OrderDetail, OrderWithLocation } from '@/features/orders/types'

// Format account name (PET_SUPPLIES → Pet Supplies)
const formatAccount = (account: string | null): string => {
 if (!account) return '-'
 return account
  .split('_')
  .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
  .join(' ')
}

// Format currency
const formatCurrency = (amount: number | null): string => {
 if (amount === null) return '€0.00'
 return `€${amount.toFixed(2)}`
}

// Format date
const formatDate = (dateString: string | null): string => {
 if (!dateString) return '-'
 return new Date(dateString).toLocaleDateString('en-IE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
 })
}

// Export order details to CSV
export const exportOrderDetailToCSV = (order: OrderDetail) => {
 const rows: Record<string, string | number>[] = []

 // Add header information
 rows.push({
  'Order ID': order.id,
  'Order Date': formatDate(order.order_date),
  Location: order.locations?.name || '-',
  'Location Number': order.locations?.location_number || '-',
  'Created By': order.user_profiles
   ? `${order.user_profiles.first_name} ${order.user_profiles.last_name}`
   : '-',
  Notes: order.notes || '-',
  'Total Amount': formatCurrency(order.total_amount),
 })

 // Add empty row
 rows.push({})

 // Add items header
 rows.push({
  'Order ID': 'ITEMS',
  'Order Date': 'Article Code',
  Location: 'EAN Code',
  'Location Number': 'Description',
  'Created By': 'Account',
  Notes: 'Unit Size',
  'Total Amount': 'Supplier',
  '': 'Quantity',
  ' ': 'Unit Price',
  '  ': 'Total Price',
  '   ': 'Savings',
 })

 // Add items
 order.order_items?.forEach((item) => {
  rows.push({
   'Order ID': '',
   'Order Date': item.master_products?.article_code || '-',
   Location: item.master_products?.ean_code || '-',
   'Location Number': item.master_products?.description || '-',
   'Created By': formatAccount(item.master_products?.account || null),
   Notes: item.master_products?.unit_size || '-',
   'Total Amount': item.supplier_products?.suppliers?.name || '-',
   '': item.quantity,
   ' ': formatCurrency(item.unit_price),
   '  ': formatCurrency(item.total_price),
   '   ': item.savings ? formatCurrency(item.savings) : '€0.00',
  })
 })

 // Generate CSV
 const csv = Papa.unparse(rows)
 const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
 const link = document.createElement('a')
 const fileName = `order_${order.id.substring(0, 8)}_${formatDate(order.order_date).replace(/\//g, '-')}.csv`

 link.href = URL.createObjectURL(blob)
 link.download = fileName
 link.click()
 URL.revokeObjectURL(link.href)
}

// Export multiple orders to CSV (for bulk export from list)
export const exportOrdersToCSV = (orders: OrderWithLocation[]) => {
 if (orders.length === 0) return
 const rows = orders.map((order) => ({
  'Order ID': order.id,
  'Order Date': formatDate(order.order_date),
  Location: order.locations?.name || '-',
  'Location Number': order.locations?.location_number || '-',
  'Items Count': order.itemsCount || 0,
  'Total Amount': formatCurrency(order.total_amount),
  'Created By': order.user_profiles
   ? `${order.user_profiles.first_name} ${order.user_profiles.last_name}`
   : '-',
  Notes: order.notes || '-',
  'Created At': formatDate(order.created_at),
 }))

 // Generate CSV
 const csv = Papa.unparse(rows)
 const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
 const link = document.createElement('a')
 const timestamp = new Date().toISOString().split('T')[0]
 const fileName = `orders_export_${timestamp}.csv`

 link.href = URL.createObjectURL(blob)
 link.download = fileName
 link.click()
 URL.revokeObjectURL(link.href)
}

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
 Sheet,
 SheetContent,
 SheetDescription,
 SheetHeader,
 SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Barcode, Download } from 'lucide-vue-next'
import type { OrderDetail } from '@/features/orders/types'
import { exportOrderDetailToCSV } from '@/features/orders/utils/exportOrders'
import OrderBarcodeSheet from '@/features/orders/components/OrderBarcodeSheet.vue'

interface Props {
 open: boolean
 order: OrderDetail | null
 isLoading?: boolean
}

interface Emits {
 (e: 'update:open', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Format currency
const formatCurrency = (amount: number | null): string => {
 if (amount === null) return '€0.00'
 return new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
 }).format(amount)
}

// Format date
const formatDate = (dateString: string | null): string => {
 if (!dateString) return '-'
 return new Date(dateString).toLocaleDateString('en-IE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
 })
}

// Format account name
const formatAccount = (account: string | null): string => {
 if (!account) return '-'
 return account
  .split('_')
  .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
  .join(' ')
}

// Computed values
const createdByName = computed(() => {
 if (!props.order?.user_profiles) return '-'
 return `${props.order.user_profiles.first_name} ${props.order.user_profiles.last_name}`
})

const totalSavings = computed(() => {
 if (!props.order?.order_items) return 0
 return props.order.order_items.reduce(
  (sum, item) => sum + (item.savings || 0),
  0,
 )
})

const barcodeSheetOpen = ref(false)

const hasBarcodeItems = computed(() => {
 return (
  props.order?.order_items?.some((item) => {
   return Boolean(item.master_products?.article_code)
  }) ?? false
 )
})

const handleExport = () => {
 if (props.order) {
  exportOrderDetailToCSV(props.order)
 }
}

watch(
 () => props.open,
 (isOpen) => {
  if (!isOpen) {
   barcodeSheetOpen.value = false
  }
 },
)
</script>

<template>
 <Sheet :open="open" @update:open="(val) => emit('update:open', val)">
  <SheetContent class="sm:max-w-[1200px] overflow-y-auto p-4">
   <SheetHeader>
    <SheetTitle>Order Details</SheetTitle>
    <SheetDescription>
     View complete order information and items
    </SheetDescription>
   </SheetHeader>

   <!-- Loading State -->
   <div v-if="isLoading" class="flex items-center justify-center py-12">
    <div
     class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"
    />
   </div>

   <!-- Order Details -->
   <div v-else-if="order" class="space-y-6 mt-6">
    <!-- Header Info -->
    <div class="space-y-4">
     <div class="grid grid-cols-2 gap-4">
      <div>
       <p class="text-sm text-muted-foreground">Order ID</p>
       <p class="font-mono text-sm">{{ order.id.substring(0, 8) }}...</p>
      </div>
      <div>
       <p class="text-sm text-muted-foreground">Order Date</p>
       <p class="font-medium">{{ formatDate(order.order_date) }}</p>
      </div>
     </div>

     <div class="grid grid-cols-2 gap-4">
      <div>
       <p class="text-sm text-muted-foreground">Location</p>
       <p class="font-medium">
        {{ order.locations?.name || '-' }}
        <span class="text-sm text-muted-foreground ml-1">
         (#{{ order.locations?.location_number || '-' }})
        </span>
       </p>
      </div>
      <div>
       <p class="text-sm text-muted-foreground">Created By</p>
       <p class="font-medium">{{ createdByName }}</p>
      </div>
     </div>

     <div class="grid grid-cols-2 gap-4">
      <div>
       <p class="text-sm text-muted-foreground">Created At</p>
       <p class="font-medium">{{ formatDate(order.created_at) }}</p>
      </div>
     </div>

     <div v-if="order.notes">
      <p class="text-sm text-muted-foreground">Notes</p>
      <p class="text-sm">{{ order.notes }}</p>
     </div>
    </div>

    <Separator />

    <!-- Order Items -->
    <div>
     <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold">Order Items</h3>
      <div class="flex items-center gap-2">
       <Button
        variant="outline"
        size="sm"
        :disabled="!hasBarcodeItems"
        @click="barcodeSheetOpen = true"
       >
        <Barcode class="h-4 w-4 mr-2" />
        View Barcodes
       </Button>
       <Button variant="outline" size="sm" @click="handleExport">
        <Download class="h-4 w-4 mr-2" />
        Export CSV
       </Button>
      </div>
     </div>

     <div class="border rounded-md">
      <Table>
       <TableHeader>
        <TableRow>
         <TableHead>Article</TableHead>
         <TableHead>EAN</TableHead>
         <TableHead>Description</TableHead>
         <TableHead>Account</TableHead>
         <TableHead>Supplier</TableHead>
         <TableHead class="text-right">Qty</TableHead>
         <TableHead class="text-right">Unit Price</TableHead>
         <TableHead class="text-right">Total</TableHead>
         <TableHead class="text-right">Savings</TableHead>
        </TableRow>
       </TableHeader>
       <TableBody>
        <TableRow v-if="!order.order_items || order.order_items.length === 0">
         <TableCell colspan="9" class="text-center text-muted-foreground">
          No items found
         </TableCell>
        </TableRow>
        <TableRow v-for="item in order.order_items" :key="item.id">
         <TableCell class="font-mono text-xs">
          {{ item.master_products?.article_code || '-' }}
         </TableCell>
         <TableCell class="font-mono text-xs">
          {{ item.master_products?.ean_code || '-' }}
         </TableCell>
         <TableCell class="max-w-[200px] truncate">
          {{ item.master_products?.description || '-' }}
          <span
           v-if="item.master_products?.unit_size"
           class="text-xs text-muted-foreground ml-1"
          >
           ({{ item.master_products.unit_size }})
          </span>
         </TableCell>
         <TableCell class="text-sm">
          {{ formatAccount(item.master_products?.account || null) }}
         </TableCell>
         <TableCell class="text-sm">
          {{ item.supplier_products?.suppliers?.name || '-' }}
         </TableCell>
         <TableCell class="text-right font-medium">
          {{ item.quantity }}
         </TableCell>
         <TableCell class="text-right">
          {{ formatCurrency(item.unit_price) }}
         </TableCell>
         <TableCell class="text-right font-medium">
          {{ formatCurrency(item.total_price) }}
         </TableCell>
         <TableCell
          class="text-right"
          :class="
           item.savings && item.savings > 0
            ? 'text-success font-medium'
            : 'text-muted-foreground'
          "
         >
          {{ item.savings ? formatCurrency(item.savings) : '-' }}
         </TableCell>
        </TableRow>
       </TableBody>
      </Table>
     </div>
    </div>

    <Separator />

    <!-- Order Totals -->
    <div class="space-y-3">
     <div class="flex justify-between text-lg">
      <span class="font-medium">Subtotal:</span>
      <span class="font-semibold">{{
       formatCurrency(order.total_amount)
      }}</span>
     </div>
     <div
      v-if="totalSavings > 0"
      class="flex justify-between text-lg text-success"
     >
      <span class="font-medium">Total Saved:</span>
      <span class="font-semibold">{{ formatCurrency(totalSavings) }}</span>
     </div>
     <Separator />
     <div class="flex justify-between text-xl">
      <span class="font-bold">Grand Total:</span>
      <span class="font-bold">{{ formatCurrency(order.total_amount) }}</span>
     </div>
    </div>
   </div>

   <!-- No Order Selected -->
   <div
    v-else
    class="flex items-center justify-center py-12 text-muted-foreground"
   >
    No order selected
   </div>
  </SheetContent>
 </Sheet>

 <OrderBarcodeSheet
  v-model:open="barcodeSheetOpen"
  :order="order"
  :is-loading="isLoading"
 />
</template>

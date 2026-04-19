<script setup lang="ts">
import {
 Sheet,
 SheetContent,
 SheetDescription,
 SheetHeader,
 SheetTitle,
} from '@/components/ui/sheet'
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table'
import type {
 ProductComparison,
 SupplierRanking,
} from '@/features/priceCheck/types'
import { computed } from 'vue'

interface Props {
 open: boolean
 supplierRanking: SupplierRanking | null
 products: ProductComparison[]
 isLocalOrder?: boolean
}

type Emits = (e: 'update:open', value: boolean) => void

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Format currency
const formatCurrency = (amount: number): string => {
 return new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
 }).format(amount)
}

// Get the title based on supplier or local order
const sheetTitle = computed(() => {
 if (!props.supplierRanking) return 'Product Details'
 if (props.isLocalOrder) {
  return 'Products Where Order is Best'
 }
 return `Products Where ${props.supplierRanking.supplier_name} is Cheaper`
})

// Get the description
const sheetDescription = computed(() => {
 const count = props.products.length
 if (!props.supplierRanking) return ''
 if (props.isLocalOrder) {
  return `${count} product${count !== 1 ? 's' : ''} where your current order price is the best option`
 }
 return `${count} product${count !== 1 ? 's' : ''} where switching to ${props.supplierRanking.supplier_name} would save money`
})

// Get supplier price for a product
const getSupplierPrice = (product: ProductComparison): number | null => {
 if (!props.supplierRanking || props.isLocalOrder) return null
 const prices = product.supplier_prices[props.supplierRanking.supplier_id]
 if (!prices || prices.length === 0) return null
 const firstPrice = prices[0]
 if (!firstPrice) return null
 return firstPrice.unit_price
}

// Get supplier product code
const getSupplierCode = (product: ProductComparison): string => {
 if (!props.supplierRanking || props.isLocalOrder) return '-'
 const prices = product.supplier_prices[props.supplierRanking.supplier_id]
 if (!prices || prices.length === 0) return '-'
 const firstPrice = prices[0]
 if (!firstPrice) return '-'
 return firstPrice.supplier_product_code || '-'
}

// Calculate savings for a product (line total = unit savings * quantity)
const getSavings = (product: ProductComparison): number => {
 if (props.isLocalOrder) {
  // For local order, savings is the difference between best supplier price and order price
  // (should be 0 or negative since order is best)
  return 0
 }
 const supplierPrice = getSupplierPrice(product)
 if (supplierPrice === null) return 0
 // Multiply by quantity to get line savings
 return (product.order.unit_cost - supplierPrice) * product.order.quantity
}

// Total savings across all products in the list
const totalSavings = computed(() => {
 if (props.isLocalOrder) return 0
 return props.products.reduce((sum, product) => {
  return sum + getSavings(product)
 }, 0)
})

// Total order cost for products in the list (use line_cost which is unit_cost * quantity)
const totalOrderCost = computed(() => {
 return props.products.reduce((sum, product) => {
  return sum + product.order.line_cost
 }, 0)
})

// Total supplier cost for products in the list (unit_price * quantity)
const totalSupplierCost = computed(() => {
 if (props.isLocalOrder) return totalOrderCost.value
 return props.products.reduce((sum, product) => {
  const supplierPrice = getSupplierPrice(product)
  const quantity = product.order.quantity
  return sum + (supplierPrice ?? product.order.unit_cost) * quantity
 }, 0)
})
</script>

<template>
 <Sheet :open="open" @update:open="(val) => emit('update:open', val)">
  <SheetContent class="sm:max-w-[900px] overflow-y-auto p-4">
   <SheetHeader>
    <SheetTitle>{{ sheetTitle }}</SheetTitle>
    <SheetDescription>{{ sheetDescription }}</SheetDescription>
   </SheetHeader>

   <div v-if="products.length > 0" class="mt-6">
    <!-- Products Table -->
    <div class="border rounded-md">
     <Table>
      <TableHeader>
       <TableRow>
        <TableHead>Article Code</TableHead>
        <TableHead v-if="!isLocalOrder">Supplier Code</TableHead>
        <TableHead class="max-w-[250px]">Description</TableHead>
        <TableHead class="text-right">Qty</TableHead>
        <TableHead class="text-right">Baseline Price</TableHead>
        <TableHead v-if="!isLocalOrder" class="text-right">
         Supplier Price
        </TableHead>
        <TableHead v-if="!isLocalOrder" class="text-right"> Savings </TableHead>
       </TableRow>
      </TableHeader>
      <TableBody>
       <TableRow v-for="product in products" :key="product.product_id">
        <TableCell class="font-mono text-xs">
         {{ product.article_code }}
        </TableCell>
        <TableCell v-if="!isLocalOrder" class="font-mono text-xs">
         {{ getSupplierCode(product) }}
        </TableCell>
        <TableCell class="max-w-[250px] truncate">
         {{ product.description }}
         <span
          v-if="product.unit_size"
          class="text-xs text-muted-foreground ml-1"
         >
          ({{ product.unit_size }})
         </span>
        </TableCell>
        <TableCell class="text-right">
         {{ product.order.quantity }}
        </TableCell>
        <TableCell class="text-right">
         {{ formatCurrency(product.order.unit_cost) }}
        </TableCell>
        <TableCell v-if="!isLocalOrder" class="text-right">
         <span
          v-if="getSupplierPrice(product) !== null"
          class="text-success font-medium"
         >
          {{ formatCurrency(getSupplierPrice(product)!) }}
         </span>
         <span v-else class="text-muted-foreground">-</span>
        </TableCell>
        <TableCell v-if="!isLocalOrder" class="text-right">
         <span v-if="getSavings(product) > 0" class="text-success font-medium">
          {{ formatCurrency(getSavings(product)) }}
         </span>
         <span v-else class="text-muted-foreground">-</span>
        </TableCell>
       </TableRow>
      </TableBody>
     </Table>
    </div>

    <!-- Summary Footer -->
    <div class="mt-4 pt-4 border-t space-y-2">
     <div class="flex justify-between text-sm">
      <span class="text-muted-foreground">Total Baseline Cost:</span>
      <span class="font-medium">{{ formatCurrency(totalOrderCost) }}</span>
     </div>
     <div v-if="!isLocalOrder" class="flex justify-between text-sm">
      <span class="text-muted-foreground">Total Supplier Cost:</span>
      <span class="font-medium text-success">
       {{ formatCurrency(totalSupplierCost) }}
      </span>
     </div>
     <div
      v-if="!isLocalOrder && totalSavings > 0"
      class="flex justify-between text-lg font-semibold pt-2 border-t"
     >
      <span>Total Savings:</span>
      <span class="text-success">
       {{ formatCurrency(totalSavings) }}
      </span>
     </div>
    </div>
   </div>

   <!-- Empty State -->
   <div
    v-else
    class="flex items-center justify-center py-12 text-muted-foreground"
   >
    No products to display
   </div>
  </SheetContent>
 </Sheet>
</template>

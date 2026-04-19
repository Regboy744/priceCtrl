<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import type {
 ProductComparison,
 Supplier,
 SupplierPrice,
} from '@/features/priceCheck/types'
import { ChevronRight } from 'lucide-vue-next'
import { computed } from 'vue'
import ProductThresholdCell from './ProductThresholdCell.vue'
import SupplierPriceCell from './SupplierPriceCell.vue'

interface Props {
 product: ProductComparison
 suppliers: Supplier[]
 thresholds: Record<string, number>
 /** `true` when this row is a variant under an expanded primary row. */
 variant?: boolean
 /** Primary-row only: whether there are extra pack-variant rows below. */
 hasVariants?: boolean
 /** Primary-row only: whether the variants are currently visible. */
 expanded?: boolean
 isSelected: (productId: string, supplierId: string) => boolean
}

const props = withDefaults(defineProps<Props>(), {
 variant: false,
 hasVariants: false,
 expanded: false,
})

const emit = defineEmits<{
 'toggle-expanded': []
 'toggle-selection': [
  product: ProductComparison,
  supplier: Supplier,
  price: SupplierPrice,
 ]
}>()

const formatCurrency = (amount: number): string =>
 new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
 }).format(amount)

const bestSupplierName = computed(() => {
 if (props.product.evaluation.order_is_best) return 'Order'
 const id = props.product.evaluation.winning_supplier_id
 if (!id) return '-'
 return props.suppliers.find((s) => s.id === id)?.name ?? '-'
})

const rowClass = computed(() =>
 props.variant ? 'bg-muted/20 hover:bg-muted/40' : 'hover:bg-muted/30',
)

const bestPriceClass = computed(() => {
 const base = props.product.evaluation.order_is_best
  ? 'text-muted-foreground'
  : 'text-success'
 return props.variant ? `${base}/70` : base
})
</script>

<template>
 <TableRow :class="rowClass">
  <!-- Expand -->
  <TableCell class="w-8 py-2">
   <Button
    v-if="!variant && hasVariants"
    variant="ghost"
    size="icon"
    class="h-6 w-6"
    @click="emit('toggle-expanded')"
   >
    <ChevronRight
     class="h-4 w-4 transition-transform duration-200"
     :class="{ 'rotate-90': expanded }"
    />
   </Button>
  </TableCell>

  <!-- Article -->
  <TableCell class="py-2">
   <span
    :class="[
     'font-mono text-xs',
     variant ? 'text-muted-foreground' : '',
    ]"
   >
    {{ product.article_code }}
   </span>
  </TableCell>

  <!-- Description -->
  <TableCell class="py-2">
   <span
    :class="[
     'text-xs max-w-[320px] truncate block',
     variant ? 'text-muted-foreground' : '',
    ]"
    :title="product.description"
   >
    {{ product.description }}
   </span>
  </TableCell>

  <!-- Size -->
  <TableCell class="py-2">
   <Badge
    v-if="product.unit_size"
    variant="outline"
    :class="[
     'text-[10px] px-1.5 py-0 font-medium',
     variant ? 'border-dashed' : '',
    ]"
   >
    {{ product.unit_size }}
   </Badge>
   <span v-else class="text-xs text-muted-foreground">-</span>
  </TableCell>

  <!-- Qty -->
  <TableCell class="py-2 text-center">
   <span
    :class="[
     'text-xs tabular-nums',
     variant ? 'text-muted-foreground' : '',
    ]"
   >
    {{ product.order.quantity }}
   </span>
  </TableCell>

  <!-- Order Price -->
  <TableCell class="py-2 text-center">
   <div class="flex flex-col items-center">
    <span
     :class="[
      'text-xs font-medium tabular-nums',
      variant ? 'text-muted-foreground' : '',
     ]"
    >
     {{ formatCurrency(product.order.unit_cost) }}
    </span>
    <Badge
     v-if="product.evaluation.order_is_best"
     variant="outline"
     :class="[
      'text-[9px] px-1 py-0 mt-0.5',
      variant
       ? 'border-success/50 text-success/70'
       : 'border-success text-success',
     ]"
    >
     Best
    </Badge>
   </div>
  </TableCell>

  <!-- Supplier Prices -->
  <TableCell
   v-for="supplier in suppliers"
   :key="supplier.id"
   class="py-2 text-center"
  >
   <SupplierPriceCell
    :product="product"
    :supplier="supplier"
    :threshold-pct="thresholds[supplier.id] ?? 0"
    :is-selected="isSelected(product.product_id, supplier.id)"
    :muted="variant"
    @toggle="(price) => emit('toggle-selection', product, supplier, price)"
   />
  </TableCell>

  <!-- Best Price -->
  <TableCell class="py-2 text-center">
   <div :class="['text-xs font-bold tabular-nums', bestPriceClass]">
    {{ formatCurrency(product.evaluation.winning_price ?? 0) }}
   </div>
   <div
    class="text-[10px] text-muted-foreground truncate max-w-[60px] mx-auto"
    :title="bestSupplierName"
   >
    {{ bestSupplierName }}
   </div>
   <div
    v-if="
     !product.evaluation.order_is_best &&
     (product.evaluation.potential_savings ?? 0) > 0
    "
    :class="[
     'text-[10px] font-medium',
     variant ? 'text-success/70' : 'text-success',
    ]"
   >
    Save {{ formatCurrency(product.evaluation.potential_savings ?? 0) }}
   </div>
  </TableCell>

  <!-- Threshold -->
  <TableCell class="py-2 text-center">
   <ProductThresholdCell
    :product="product"
    :suppliers="suppliers"
    :muted="variant"
   />
  </TableCell>
 </TableRow>
</template>

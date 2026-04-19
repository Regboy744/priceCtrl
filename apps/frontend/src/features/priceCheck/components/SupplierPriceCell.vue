<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import {
 Tooltip,
 TooltipContent,
 TooltipTrigger,
} from '@/components/ui/tooltip'
import type {
 ProductComparison,
 Supplier,
 SupplierPrice,
} from '@/features/priceCheck/types'
import { Check, Info, Minus } from 'lucide-vue-next'
import { computed } from 'vue'

interface Props {
 product: ProductComparison
 supplier: Supplier
 /** Per-supplier switching threshold (percent). 0 disables the check. */
 thresholdPct?: number
 isSelected: boolean
 /** `true` when muted styling should apply (e.g. variant row). */
 muted?: boolean
}

const props = withDefaults(defineProps<Props>(), {
 thresholdPct: 0,
 muted: false,
})

const emit = defineEmits<{
 toggle: [price: SupplierPrice]
}>()

const allPrices = computed<SupplierPrice[]>(
 () => props.product.supplier_prices[props.supplier.id] ?? [],
)
const primaryPrice = computed<SupplierPrice | null>(
 () => allPrices.value[0] ?? null,
)
const hasMorePacks = computed(() => allPrices.value.length > 1)

/**
 * This supplier offers the best-value price the backend picked for the
 * product (only relevant when the order itself isn't best).
 */
const isWinningSupplier = computed(
 () =>
  !props.product.evaluation.order_is_best &&
  props.product.evaluation.winning_supplier_id === props.supplier.id,
)

/**
 * Cheaper than order but this supplier's own switching threshold is not
 * satisfied, so it should not drive a recommendation. Uses per-supplier
 * threshold — independent of whether some OTHER supplier qualified.
 */
const isBelowThreshold = computed(() => {
 const price = primaryPrice.value
 if (!price || price.difference_vs_order >= 0) return false
 const orderUnitCost = props.product.order.unit_cost
 if (orderUnitCost <= 0) return false
 const requiredPrice = orderUnitCost * (1 - props.thresholdPct / 100)
 return price.unit_price > requiredPrice
})

const containerClass = computed(() => {
 if (props.isSelected) return 'bg-primary/15 ring-1 ring-primary/40'
 if (isWinningSupplier.value) return 'bg-success/10 hover:bg-success/20'
 if (isBelowThreshold.value) return 'opacity-50 hover:opacity-75'
 return 'hover:bg-muted/50'
})

const priceTextClass = computed(() => {
 if (props.isSelected) return 'text-primary'
 if (isWinningSupplier.value) return 'text-success'
 if (isBelowThreshold.value) return 'text-muted-foreground'
 return props.muted ? 'text-muted-foreground' : ''
})

const diffTextClass = computed(() => {
 if (isBelowThreshold.value) return 'text-warning opacity-80 font-bold'
 const diff = primaryPrice.value?.difference_vs_order ?? 0
 if (diff < 0) return 'text-success'
 if (diff > 0) return 'text-destructive'
 return 'text-muted-foreground'
})

const formatCurrency = (amount: number): string =>
 new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
 }).format(amount)

const formatDiff = (diff: number): string =>
 diff < 0 ? formatCurrency(diff) : `+${formatCurrency(diff)}`
</script>

<template>
 <template v-if="primaryPrice">
  <div
   :class="[
    'py-0.5 px-1 -mx-1 rounded relative cursor-pointer transition-colors',
    containerClass,
   ]"
   @click="emit('toggle', primaryPrice)"
  >
   <div class="flex items-center justify-center gap-0.5">
    <span
     :class="['text-xs font-medium tabular-nums', priceTextClass]"
    >
     {{ formatCurrency(primaryPrice.unit_price) }}
    </span>
    <Check
     v-if="isWinningSupplier"
     class="h-3 w-3 text-success shrink-0"
    />
   </div>

   <div
    v-if="primaryPrice.difference_vs_order !== 0"
    :class="['text-[10px] tabular-nums', diffTextClass]"
   >
    {{ formatDiff(primaryPrice.difference_vs_order) }}
   </div>

   <Tooltip v-if="primaryPrice.is_special_price">
    <TooltipTrigger as-child>
     <Badge
      variant="secondary"
      class="text-[9px] px-1 py-0 h-3.5 mt-0.5 cursor-help"
     >
      Special
      <Info v-if="primaryPrice.special_price_notes" class="h-2.5 w-2.5 ml-0.5" />
     </Badge>
    </TooltipTrigger>
    <TooltipContent
     v-if="primaryPrice.special_price_notes || primaryPrice.valid_until"
     class="bg-popover text-popover-foreground border shadow-md"
    >
     <p v-if="primaryPrice.special_price_notes">
      {{ primaryPrice.special_price_notes }}
     </p>
     <p v-if="primaryPrice.valid_until" class="text-muted-foreground">
      Valid until: {{ primaryPrice.valid_until }}
     </p>
    </TooltipContent>
   </Tooltip>

   <Tooltip v-if="hasMorePacks">
    <TooltipTrigger as-child>
     <Badge
      variant="outline"
      class="text-[9px] px-1 py-0 h-3.5 mt-0.5 cursor-help border-dashed"
     >
      +{{ allPrices.length - 1 }} more
     </Badge>
    </TooltipTrigger>
    <TooltipContent
     class="max-w-[200px] bg-popover text-popover-foreground border shadow-md"
    >
     <p class="font-medium text-xs mb-1">Other pack sizes:</p>
     <div
      v-for="(altPrice, idx) in allPrices.slice(1)"
      :key="idx"
      class="text-xs flex justify-between gap-2"
     >
      <span class="font-mono text-muted-foreground">
       {{ altPrice.supplier_product_code }}
      </span>
      <span>{{ formatCurrency(altPrice.unit_price) }}</span>
     </div>
    </TooltipContent>
   </Tooltip>
  </div>
 </template>
 <template v-else>
  <Minus class="h-3 w-3 mx-auto text-muted-foreground/50" />
 </template>
</template>

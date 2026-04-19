<script setup lang="ts">
import {
 Tooltip,
 TooltipContent,
 TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ProductComparison, Supplier } from '@/features/priceCheck/types'
import { CheckCircle2, Minus, XCircle } from 'lucide-vue-next'
import { computed } from 'vue'

interface Props {
 product: ProductComparison
 suppliers: Supplier[]
 muted?: boolean
}

const props = withDefaults(defineProps<Props>(), { muted: false })

const formatCurrency = (amount: number): string =>
 new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
 }).format(amount)

const thresholdSupplierName = computed(() => {
 const id = props.product.evaluation.winning_supplier_id
 if (!id) return '-'
 return props.suppliers.find((s) => s.id === id)?.name ?? '-'
})
</script>

<template>
 <template v-if="product.evaluation">
  <Tooltip>
   <TooltipTrigger as-child>
    <div class="inline-flex items-center justify-center cursor-help">
     <CheckCircle2
      v-if="product.evaluation.threshold_met"
      :class="['h-4 w-4', muted ? 'text-success/70' : 'text-success']"
     />
     <XCircle
      v-else
      :class="['h-4 w-4', muted ? 'text-destructive/70' : 'text-destructive']"
     />
    </div>
   </TooltipTrigger>
   <TooltipContent
    class="max-w-[220px] bg-popover text-popover-foreground border shadow-md"
   >
    <div class="space-y-1 text-xs">
     <p class="font-medium">{{ thresholdSupplierName }}</p>
     <div class="flex justify-between gap-4">
      <span class="text-muted-foreground">Threshold:</span>
      <span>{{ product.evaluation.threshold_percentage }}%</span>
     </div>
     <div class="flex justify-between gap-4">
      <span class="text-muted-foreground">Required price:</span>
      <span>{{ formatCurrency(product.evaluation.required_price_to_win) }}</span>
     </div>
     <div class="flex justify-between gap-4">
      <span class="text-muted-foreground">Actual difference:</span>
      <span
       :class="
        product.evaluation.supplier_price_difference_pct > 0
         ? 'text-success'
         : 'text-destructive'
       "
      >
       {{ Math.abs(product.evaluation.supplier_price_difference_pct).toFixed(2) }}%
      </span>
     </div>
     <p
      :class="[
       'font-medium pt-1 border-t',
       product.evaluation.threshold_met
        ? 'text-success'
        : 'text-destructive',
      ]"
     >
      {{
       product.evaluation.threshold_met
        ? 'Threshold met — recommend switching'
        : 'Below threshold — keep order'
      }}
     </p>
    </div>
   </TooltipContent>
  </Tooltip>
 </template>
 <template v-else>
  <Minus class="h-3 w-3 mx-auto text-muted-foreground/50" />
 </template>
</template>

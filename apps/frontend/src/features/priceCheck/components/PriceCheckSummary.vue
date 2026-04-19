<script setup lang="ts">
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table'
import {
 Collapsible,
 CollapsibleContent,
 CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type {
 ComparisonSummary,
 ParseResult,
 ProductComparison,
 Supplier,
} from '@/features/priceCheck/types'
import {
 ArrowDown,
 CheckSquare,
 ChevronDown,
 FileSpreadsheet,
 Package,
 PackageX,
 Receipt,
 ShoppingCart,
 TrendingDown,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

interface Props {
 summary: ComparisonSummary
 suppliers: Supplier[]
 products: ProductComparison[]
 parseResult?: ParseResult | null
 /** Number of selected products (for ordering) */
 selectedCount?: number
 /** Total number of products */
 totalCount?: number
}

const props = withDefaults(defineProps<Props>(), {
 parseResult: null,
 selectedCount: 0,
 totalCount: 0,
})

const formatCurrency = (amount: number): string =>
 new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
 }).format(amount)

const formatPercentage = (value: number): string =>
 `${Math.abs(value).toFixed(1)}%`

const sortedSupplierRankings = computed(() =>
 [...props.summary.supplier_rankings].sort((a, b) => {
  if (a.supplier_id === 'local_order') return 1
  if (b.supplier_id === 'local_order') return -1
  if (a.products_won !== b.products_won) {
   return b.products_won - a.products_won
  }
  return b.savings_on_won_products - a.savings_on_won_products
 }),
)

const getSupplierRank = (supplierId: string): number => {
 if (supplierId === 'local_order') return 0
 const suppliersOnly = sortedSupplierRankings.value.filter(
  (s) => s.supplier_id !== 'local_order',
 )
 return suppliersOnly.findIndex((s) => s.supplier_id === supplierId) + 1
}

const isLocalOrder = (supplierId: string): boolean =>
 supplierId === 'local_order'

const getThresholdPercentage = (supplierId: string): number | null => {
 if (!props.summary.thresholds_applied) return null
 return props.summary.thresholds_applied[supplierId] ?? null
}

// Rankings default to collapsed; auto-open the first time user picks something.
const rankingsOpen = ref(false)
watch(
 () => props.selectedCount,
 (count, prev) => {
  if ((prev ?? 0) === 0 && count > 0) rankingsOpen.value = true
 },
)

const metrics = computed(() => [
 {
  key: 'order',
  icon: Receipt,
  label: 'Order',
  value: formatCurrency(props.summary.order_totals.total_order_value),
  tone: 'text-primary',
 },
 {
  key: 'found',
  icon: Package,
  label: 'Found',
  value: `${props.summary.counts.products_found}/${props.summary.counts.total_items_submitted}`,
  tone: 'text-success',
 },
 {
  key: 'notfound',
  icon: PackageX,
  label: 'Not Found',
  value: props.summary.counts.products_not_found.length,
  tone: 'text-warning',
 },
 {
  key: 'unpriced',
  icon: PackageX,
  label: 'Unpriced',
  value: props.summary.counts.products_unpriced?.length ?? 0,
  tone: 'text-warning',
 },
 {
  key: 'savings',
  icon: TrendingDown,
  label: 'Savings',
  value: formatCurrency(
   props.summary.evaluation_results.max_potential_savings ?? 0,
  ),
  tone: 'text-success',
 },
 {
  key: 'selected',
  icon: ShoppingCart,
  label: 'Selected',
  value: `${props.selectedCount}/${props.totalCount}`,
  tone: 'text-chart-4',
 },
])
</script>

<template>
 <div class="space-y-2">
  <!-- Context strip: parse info + selection indicator, single thin row -->
  <div
   v-if="parseResult || selectedCount > 0"
   class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground px-1"
  >
   <div v-if="parseResult" class="flex items-center gap-1.5">
    <FileSpreadsheet class="h-3.5 w-3.5" />
    <span>
     Parsed <strong class="text-foreground">{{ parseResult.valid_rows }}</strong>
     items
     <template v-if="parseResult.store_number">
      · Store #{{ parseResult.store_number }}
     </template>
    </span>
   </div>
   <div
    v-if="selectedCount > 0"
    class="flex items-center gap-1.5 text-primary"
   >
    <CheckSquare class="h-3.5 w-3.5" />
    <span>
     <strong>{{ selectedCount }}</strong> selected for ordering
    </span>
   </div>
  </div>

  <!-- Compact metric strip -->
  <div
   class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border rounded-lg border overflow-hidden"
  >
   <div
    v-for="m in metrics"
    :key="m.key"
    class="flex items-center gap-2.5 bg-card px-3 py-2"
   >
    <component :is="m.icon" :class="['h-4 w-4 shrink-0', m.tone]" />
    <div class="min-w-0 leading-tight">
     <div class="text-sm font-semibold truncate">{{ m.value }}</div>
     <div class="text-[11px] text-muted-foreground uppercase tracking-wide">
      {{ m.label }}
     </div>
    </div>
   </div>
  </div>

  <!-- Supplier rankings: collapsible -->
  <Collapsible v-model:open="rankingsOpen">
   <div class="border rounded-lg overflow-hidden">
    <CollapsibleTrigger as-child>
     <button
      class="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40 transition-colors text-left"
     >
      <span class="text-sm font-medium">
       Supplier Rankings
       <span class="text-xs text-muted-foreground font-normal">
        ({{
         sortedSupplierRankings.filter((s) => s.supplier_id !== 'local_order')
          .length
        }}
        suppliers)
       </span>
      </span>
      <ChevronDown
       class="h-4 w-4 text-muted-foreground transition-transform duration-200"
       :class="{ 'rotate-180': rankingsOpen }"
      />
     </button>
    </CollapsibleTrigger>
    <CollapsibleContent>
     <Table>
      <TableHeader>
       <TableRow class="bg-muted/50">
        <TableHead class="w-10 text-center h-9">#</TableHead>
        <TableHead class="h-9">Source</TableHead>
        <TableHead class="text-center h-9">Threshold</TableHead>
        <TableHead class="text-center h-9">Selected</TableHead>
        <TableHead class="text-right h-9">Order Cost</TableHead>
        <TableHead class="text-right h-9">Supplier Cost</TableHead>
        <TableHead class="text-right h-9">Savings</TableHead>
       </TableRow>
      </TableHeader>
      <TableBody>
       <TableRow
        v-for="supplierRanking in sortedSupplierRankings"
        :key="supplierRanking.supplier_id"
        class="hover:bg-muted/30"
       >
        <TableCell class="text-center py-1.5">
         <span
          v-if="isLocalOrder(supplierRanking.supplier_id)"
          class="text-muted-foreground text-sm"
         >
          —
         </span>
         <span v-else class="text-muted-foreground text-sm">
          {{ getSupplierRank(supplierRanking.supplier_id) }}
         </span>
        </TableCell>
        <TableCell class="py-1.5">
         <span class="font-medium text-sm">
          {{ supplierRanking.supplier_name }}
         </span>
        </TableCell>
        <TableCell class="text-center py-1.5">
         <span
          v-if="
           !isLocalOrder(supplierRanking.supplier_id) &&
           getThresholdPercentage(supplierRanking.supplier_id) !== null
          "
          class="text-sm"
         >
          {{ getThresholdPercentage(supplierRanking.supplier_id) }}%
         </span>
         <span v-else class="text-muted-foreground text-sm">—</span>
        </TableCell>
        <TableCell class="text-center py-1.5">
         <span
          :class="[
           'text-sm',
           supplierRanking.products_won > 0 ? 'font-semibold' : '',
          ]"
         >
          {{ supplierRanking.products_won }}
         </span>
        </TableCell>
        <TableCell class="text-right py-1.5">
         <span class="text-sm font-medium">
          {{ formatCurrency(supplierRanking.won_products_order_cost) }}
         </span>
        </TableCell>
        <TableCell class="text-right py-1.5">
         <span class="text-sm font-medium">
          {{ formatCurrency(supplierRanking.won_products_supplier_cost) }}
         </span>
        </TableCell>
        <TableCell class="text-right py-1.5">
         <div class="flex items-center justify-end gap-1">
          <template v-if="isLocalOrder(supplierRanking.supplier_id)">
           <span class="text-primary text-sm font-medium">Baseline</span>
          </template>
          <template v-else-if="supplierRanking.savings_on_won_products > 0">
           <ArrowDown class="h-3 w-3 text-success" />
           <span class="text-success text-sm font-medium">
            {{ formatCurrency(supplierRanking.savings_on_won_products) }}
           </span>
           <span class="text-success/70 text-xs">
            ({{ formatPercentage(supplierRanking.savings_percentage) }})
           </span>
          </template>
          <template v-else>
           <span class="text-muted-foreground text-sm">—</span>
          </template>
         </div>
        </TableCell>
       </TableRow>
      </TableBody>
     </Table>
    </CollapsibleContent>
   </div>
  </Collapsible>
 </div>
</template>

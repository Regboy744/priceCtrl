<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
 DropdownMenu,
 DropdownMenuCheckboxItem,
 DropdownMenuContent,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from '@/components/ui/popover'
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table'
import { TooltipProvider } from '@/components/ui/tooltip'
import type {
 ProductComparison,
 ProductGroup,
 Supplier,
 SupplierPrice,
} from '@/features/priceCheck/types'
import {
 ArrowUpDown,
 HelpCircle,
 Search,
 Settings2,
 Sparkles,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useOrderSubmission } from '../composables/useOrderSubmission'
import { usePriceCheck } from '../composables/usePriceCheck'
import PriceComparisonLegend from './PriceComparisonLegend.vue'
import ProductComparisonRow from './ProductComparisonRow.vue'

interface Props {
 suppliers: Supplier[]
 products: ProductComparison[]
 /** Per-supplier switching threshold in percent. */
 thresholds?: Record<string, number>
}

const props = withDefaults(defineProps<Props>(), {
 thresholds: () => ({}),
})

const { toggleSupplier, isSupplierHidden, allSuppliers } = usePriceCheck()
const { isSupplierSelectedForProduct, toggleSelection, selectAllBestPrices } =
 useOrderSubmission()

const searchFilter = ref('')
const expandedRows = ref<Set<string>>(new Set())
const sortColumn = ref<string | null>(null)
const sortDirection = ref<'asc' | 'desc'>('asc')

const groupedProducts = computed<ProductGroup[]>(() => {
 const groups = new Map<string, ProductComparison[]>()
 for (const product of props.products) {
  const ean = product.ean_code || product.product_id
  const existing = groups.get(ean) ?? []
  existing.push(product)
  groups.set(ean, existing)
 }
 return Array.from(groups.entries())
  .filter(([, products]) => products.length > 0)
  .map(([ean, products]) => ({
   ean_code: ean,
   primary: products[0] as ProductComparison,
   variants: products.slice(1),
   hasVariants: products.length > 1,
  }))
})

const matchesSearch = (product: ProductComparison, search: string): boolean => {
 if (!search) return true
 const q = search.toLowerCase()
 return (
  product.description?.toLowerCase().includes(q) ||
  product.article_code?.toLowerCase().includes(q) ||
  product.ean_code?.toLowerCase().includes(q)
 )
}

const filteredGroups = computed(() => {
 const search = searchFilter.value.trim()
 let filtered = groupedProducts.value.filter(
  (group) =>
   matchesSearch(group.primary, search) ||
   group.variants.some((v) => matchesSearch(v, search)),
 )

 if (sortColumn.value) {
  filtered = [...filtered].sort((a, b) => {
   let aVal: number | string = 0
   let bVal: number | string = 0

   switch (sortColumn.value) {
    case 'article_code':
     aVal = a.primary.article_code
     bVal = b.primary.article_code
     break
    case 'description':
     aVal = a.primary.description
     bVal = b.primary.description
     break
    case 'order_price':
     aVal = a.primary.order.unit_cost
     bVal = b.primary.order.unit_cost
     break
    case 'best_price':
     aVal = a.primary.evaluation.winning_price ?? 0
     bVal = b.primary.evaluation.winning_price ?? 0
     break
    default:
     if (sortColumn.value?.startsWith('supplier_')) {
      const supplierId = sortColumn.value.replace('supplier_', '')
      aVal = a.primary.supplier_prices[supplierId]?.[0]?.unit_price ?? Number.POSITIVE_INFINITY
      bVal = b.primary.supplier_prices[supplierId]?.[0]?.unit_price ?? Number.POSITIVE_INFINITY
     }
   }

   if (typeof aVal === 'string' && typeof bVal === 'string') {
    return sortDirection.value === 'asc'
     ? aVal.localeCompare(bVal)
     : bVal.localeCompare(aVal)
   }
   return sortDirection.value === 'asc'
    ? (aVal as number) - (bVal as number)
    : (bVal as number) - (aVal as number)
  })
 }
 return filtered
})

// Auto-expand groups whose variants match the active search query.
watch(searchFilter, (search) => {
 const q = search.trim()
 if (!q) return
 for (const group of groupedProducts.value) {
  if (
   group.variants.some((v) => matchesSearch(v, q)) &&
   !expandedRows.value.has(group.ean_code)
  ) {
   expandedRows.value.add(group.ean_code)
  }
 }
})

// Auto-expand rows the backend flagged as ambiguous so users can see the
// alternatives they must pick between.
watch(
 groupedProducts,
 (groups) => {
  let changed = false
  for (const group of groups) {
   const needsPick =
    group.primary.requires_user_pick === true ||
    group.variants.some((v) => v.requires_user_pick === true)
   if (needsPick && !expandedRows.value.has(group.ean_code)) {
    expandedRows.value.add(group.ean_code)
    changed = true
   }
  }
  if (changed) expandedRows.value = new Set(expandedRows.value)
 },
 { immediate: true },
)

const toggleExpanded = (eanCode: string) => {
 if (expandedRows.value.has(eanCode)) expandedRows.value.delete(eanCode)
 else expandedRows.value.add(eanCode)
 expandedRows.value = new Set(expandedRows.value)
}

const toggleSort = (column: string) => {
 if (sortColumn.value === column) {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
 } else {
  sortColumn.value = column
  sortDirection.value = 'asc'
 }
}

const uniqueEanCount = computed(() => groupedProducts.value.length)

const betterPricesCount = computed(
 () =>
  props.products.filter(
   (p) => !p.evaluation.order_is_best && p.evaluation.winning_supplier_id,
  ).length,
)

const handleSelectionToggle = (
 product: ProductComparison,
 supplier: Supplier,
 price: SupplierPrice,
) => toggleSelection(product, supplier, price)

const colSpan = computed(() => 8 + props.suppliers.length)

const truncateName = (name: string): string =>
 name.length > 10 ? `${name.substring(0, 10)}...` : name
</script>

<template>
 <TooltipProvider>
  <div class="space-y-3">
   <!-- Toolbar -->
   <div class="flex items-center justify-between gap-4 flex-wrap">
    <div class="text-sm text-muted-foreground">
     <span class="font-medium">{{ products.length }}</span> products
     <template v-if="products.length !== uniqueEanCount">
      across <span class="font-medium">{{ uniqueEanCount }}</span> EAN codes
     </template>
    </div>
    <div class="flex items-center gap-2">
     <div class="relative w-64">
      <Search
       class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
      />
      <Input
       v-model="searchFilter"
       placeholder="Search products..."
       class="pl-8 h-8 text-sm"
      />
     </div>

     <Button
      v-if="betterPricesCount > 0"
      variant="outline"
      size="sm"
      class="h-8"
      @click="selectAllBestPrices(products, suppliers)"
     >
      <Sparkles class="mr-2 h-4 w-4 text-success" />
      Select All Best ({{ betterPricesCount }})
     </Button>

     <DropdownMenu>
      <DropdownMenuTrigger as-child>
       <Button variant="outline" size="sm" class="h-8">
        <Settings2 class="mr-2 h-4 w-4" />
        Columns
       </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-[200px]">
       <DropdownMenuCheckboxItem
        v-for="supplier in allSuppliers"
        :key="supplier.id"
        :modelValue="!isSupplierHidden(supplier.id)"
        @update:modelValue="toggleSupplier(supplier.id)"
       >
        {{ supplier.name }}
       </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
     </DropdownMenu>

     <Popover>
      <PopoverTrigger as-child>
       <Button variant="outline" size="sm" class="h-8" aria-label="Legend">
        <HelpCircle class="h-4 w-4" />
       </Button>
      </PopoverTrigger>
      <PopoverContent align="end" class="w-64">
       <p class="text-xs font-medium mb-2">Legend</p>
       <PriceComparisonLegend />
      </PopoverContent>
     </Popover>
    </div>
   </div>

   <!-- Table -->
   <div
    class="border rounded-lg overflow-hidden [&_[data-slot=table-container]]:max-h-[55vh]"
   >
    <Table>
     <TableHeader class="bg-muted sticky top-0 z-10">
      <TableRow>
       <TableHead class="w-8" />
       <TableHead class="whitespace-nowrap">
        <Button
         variant="ghost"
         class="-ml-3 h-8 px-2 hover:bg-transparent"
         @click="toggleSort('article_code')"
        >
         <span class="font-semibold text-xs">Article</span>
         <ArrowUpDown class="ml-1 h-3 w-3" />
        </Button>
       </TableHead>
       <TableHead class="whitespace-nowrap min-w-[280px] max-w-[360px]">
        <Button
         variant="ghost"
         class="-ml-3 h-8 px-2 hover:bg-transparent"
         @click="toggleSort('description')"
        >
         <span class="font-semibold text-xs">Description</span>
         <ArrowUpDown class="ml-1 h-3 w-3" />
        </Button>
       </TableHead>
       <TableHead class="whitespace-nowrap">
        <span class="font-semibold text-xs">Size</span>
       </TableHead>
       <TableHead class="whitespace-nowrap text-center">
        <span class="font-semibold text-xs">Qty</span>
       </TableHead>
       <TableHead class="whitespace-nowrap">
        <Button
         variant="ghost"
         class="-ml-3 h-8 px-2 hover:bg-transparent"
         @click="toggleSort('order_price')"
        >
         <span class="font-semibold text-xs">Order</span>
         <ArrowUpDown class="ml-1 h-3 w-3" />
        </Button>
       </TableHead>
       <TableHead
        v-for="supplier in suppliers"
        :key="supplier.id"
        class="whitespace-nowrap text-center"
       >
        <Button
         variant="ghost"
         class="-ml-2 h-8 px-2 hover:bg-transparent"
         @click="toggleSort(`supplier_${supplier.id}`)"
        >
         <span
          class="font-semibold text-xs truncate max-w-[70px]"
          :title="supplier.name"
         >
          {{ truncateName(supplier.name) }}
         </span>
         <ArrowUpDown class="ml-1 h-3 w-3 shrink-0" />
        </Button>
       </TableHead>
       <TableHead class="whitespace-nowrap text-center">
        <Button
         variant="ghost"
         class="-ml-2 h-8 px-2 hover:bg-transparent"
         @click="toggleSort('best_price')"
        >
         <span class="font-semibold text-xs text-success">Best</span>
         <ArrowUpDown class="ml-1 h-3 w-3" />
        </Button>
       </TableHead>
       <TableHead class="whitespace-nowrap text-center">
        <span class="font-semibold text-xs">Threshold</span>
       </TableHead>
      </TableRow>
     </TableHeader>

     <TableBody>
      <template v-if="filteredGroups.length">
       <template v-for="group in filteredGroups" :key="group.ean_code">
        <ProductComparisonRow
         :product="group.primary"
         :suppliers="suppliers"
         :thresholds="thresholds"
         :has-variants="group.hasVariants"
         :expanded="expandedRows.has(group.ean_code)"
         :is-selected="isSupplierSelectedForProduct"
         @toggle-expanded="toggleExpanded(group.ean_code)"
         @toggle-selection="handleSelectionToggle"
        />
        <template v-if="expandedRows.has(group.ean_code)">
         <ProductComparisonRow
          v-for="variant in group.variants"
          :key="variant.product_id"
          variant
          :product="variant"
          :suppliers="suppliers"
          :thresholds="thresholds"
          :is-selected="isSupplierSelectedForProduct"
          @toggle-selection="handleSelectionToggle"
         />
        </template>
       </template>
      </template>
      <template v-else>
       <TableRow>
        <TableCell
         :colspan="colSpan"
         class="h-20 text-center text-sm text-muted-foreground"
        >
         No products found.
        </TableCell>
       </TableRow>
      </template>
     </TableBody>
    </Table>
   </div>
  </div>
 </TooltipProvider>
</template>

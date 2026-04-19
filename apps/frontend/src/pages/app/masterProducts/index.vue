<script setup lang="ts">
import { h, ref, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { toast } from 'vue-sonner'
import type { ColumnDef } from '@tanstack/vue-table'
import type { DataTableConfig } from '@/types/shared/custom.types'
import DataTable from '@/components/appDataTable/DataTable.vue'
import Button from '@/components/ui/button/Button.vue'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
 Select,
 SelectContent,
 SelectGroup,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select'
import { ArrowUpDown, Upload, History } from 'lucide-vue-next'
import MasterProductActions from '@/features/masterProducts/components/MasterProductActions.vue'
import MasterProductEditForm from '@/features/masterProducts/components/MasterProductEditForm.vue'
import MasterProductCsvUpload from '@/features/masterProducts/components/MasterProductCsvUpload.vue'
import MasterProductCsvPreview from '@/features/masterProducts/components/MasterProductCsvPreview.vue'
import { useMasterProducts } from '@/features/masterProducts/composables/useMasterProducts'
import SharedSheet from '@/components/shared/SharedSheet.vue'
import type {
 MasterProductWithBrand,
 CsvRow,
 CsvPreviewData,
} from '@/features/masterProducts/types'

definePage({
 meta: {
  allowedRoles: ['master'],
 },
})

const {
 masterProducts,
 brands,
 selectedBrandId,
 uploadProgress,
 fetchMasterProducts,
 fetchBrands,
 saveMasterProduct,
 removeMasterProduct,
 activateMasterProduct,
 filterByBrand,
 setArticleCodeFilter,
 setEanCodeFilter,
 setDescriptionFilter,
 generateCsvPreview,
 applyCsvUpsert,
 cancelUpload,
} = useMasterProducts()

// Fetch data
await Promise.all([fetchMasterProducts(), fetchBrands()])

// CSV Upload state
const csvPreviewData = ref<CsvPreviewData | null>(null)
const csvRows = ref<CsvRow[]>([])
const isApplyingCsv = ref(false)
const showPreview = ref(false)
const csvSheetOpen = ref(false)

// Reset CSV state when sheet closes
const resetCsvState = () => {
 csvPreviewData.value = null
 csvRows.value = []
 showPreview.value = false
 isApplyingCsv.value = false
}

// Watch CSV sheet and reset state when closed
watch(csvSheetOpen, (isOpen) => {
 if (!isOpen) {
  resetCsvState()
 }
})

// Handle brand filter change
const handleBrandFilterChange = async (value: unknown) => {
 const brandId = value ? String(value) : null
 if (brandId === 'all') {
  await filterByBrand(null)
 } else if (brandId) {
  await filterByBrand(brandId)
 }
}

// Handle CSV preview request
const handleCsvPreview = (data: { brandId: string; rows: CsvRow[] }) => {
 csvRows.value = data.rows
 const preview = generateCsvPreview(data.brandId, data.rows)
 if (preview) {
  csvPreviewData.value = preview
  showPreview.value = true
 }
}

// Handle CSV apply
const handleCsvApply = async () => {
 if (!csvPreviewData.value) return

 isApplyingCsv.value = true
 try {
  const result = await applyCsvUpsert(
   csvPreviewData.value.brandId,
   csvRows.value,
  )
  if (result) {
   // Show toast with results
   if (result.inserted > 0 && result.skipped === 0) {
    toast.success(`Inserted ${result.inserted} products`)
   } else if (result.inserted > 0 && result.skipped > 0) {
    toast.success(
     `Inserted ${result.inserted} products, skipped ${result.skipped} (already exist)`,
    )
   } else if (result.inserted === 0 && result.skipped > 0) {
    toast.info(`No products inserted - all ${result.skipped} already exist`)
   }

   if (result.errors && result.errors.length > 0) {
    toast.error(`${result.errors.length} errors occurred during import`)
   }

   // Reset state
   csvPreviewData.value = null
   csvRows.value = []
   showPreview.value = false
  }
 } finally {
  isApplyingCsv.value = false
 }
}

// Handle CSV back
const handleCsvBack = () => {
 showPreview.value = false
 csvPreviewData.value = null
}

// Handle CSV cancel
const handleCsvCancel = () => {
 cancelUpload()
}

// Local filter inputs (for debouncing)
const localArticleCodeFilter = ref('')
const localEanCodeFilter = ref('')
const localDescriptionFilter = ref('')

// Debounced watchers for server-side filtering
watchDebounced(
 localArticleCodeFilter,
 async (value) => {
  setArticleCodeFilter(value)
  await fetchMasterProducts()
 },
 { debounce: 400 },
)

watchDebounced(
 localEanCodeFilter,
 async (value) => {
  setEanCodeFilter(value)
  await fetchMasterProducts()
 },
 { debounce: 400 },
)

watchDebounced(
 localDescriptionFilter,
 async (value) => {
  setDescriptionFilter(value)
  await fetchMasterProducts()
 },
 { debounce: 400 },
)

// Table config
const tableConfig: DataTableConfig = {
 features: {
  rowSelection: false,
  pagination: true,
  sorting: true,
  filtering: false, // Server-side filtering via custom inputs
  columnVisibility: true,
 },
 pageSize: 20,
}

// Table columns
const columns: ColumnDef<MasterProductWithBrand>[] = [
 {
  accessorKey: 'brands',
  header: () => h('div', { class: 'text-left' }, 'Brand'),
  cell: ({ row }) => {
   const brand = row.original.brands
   return h('div', { class: 'text-left font-medium' }, brand?.name || '-')
  },
  enableSorting: false,
 },
 {
  accessorKey: 'article_code',
  header: ({ column }) => {
   return h(
    Button,
    {
     class: 'hover:bg-transparent hover:text-current',
     variant: 'ghost',
     onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
    },
    () => ['Article Code', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })],
   )
  },
  cell: ({ row }) => {
   return h(
    'div',
    { class: 'text-left font-mono text-sm' },
    row.getValue('article_code'),
   )
  },
  enableSorting: true,
 },
 {
  accessorKey: 'ean_code',
  header: () => h('div', { class: 'text-left' }, 'EAN Code'),
  cell: ({ row }) => {
   const hasHistory =
    (row.original.ean_history as string[] | null)?.length ?? 0 > 0
   return h('div', { class: 'flex items-center gap-1' }, [
    h('span', { class: 'font-mono text-sm' }, row.getValue('ean_code')),
    hasHistory
     ? h(History, {
        class: 'w-3 h-3 text-primary',
        title: 'Has EAN history',
       })
     : null,
   ])
  },
 },
 {
  accessorKey: 'description',
  header: ({ column }) => {
   return h(
    Button,
    {
     class: 'hover:bg-transparent hover:text-current',
     variant: 'ghost',
     onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
    },
    () => ['Description', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })],
   )
  },
  cell: ({ row }) => {
   return h(
    'div',
    { class: 'text-left font-medium max-w-64 truncate' },
    row.getValue('description'),
   )
  },
  enableSorting: true,
 },
 {
  accessorKey: 'account',
  header: () => h('div', { class: 'text-left' }, 'Account'),
  cell: ({ row }) => {
   const account = row.getValue('account') as string | null
   if (!account) return h('span', { class: 'text-muted-foreground' }, '-')
   const formatted = account
    .split('_')
    .map((word: string) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
   return h('div', { class: 'text-left text-sm' }, formatted)
  },
 },
 {
  accessorKey: 'unit_size',
  header: () => h('div', { class: 'text-left' }, 'Unit Size'),
  cell: ({ row }) => {
   return h('div', { class: 'text-left' }, row.getValue('unit_size') || '-')
  },
 },
 {
  accessorKey: 'is_active',
  header: () => h('div', { class: 'text-center' }, 'Status'),
  cell: ({ row }) => {
   const isActive = row.getValue('is_active')
   return h(
    'div',
    { class: 'text-center' },
    h(
     Badge,
     {
      variant: isActive ? 'default' : 'secondary',
      class: isActive ? 'bg-success' : '',
     },
     () => (isActive ? 'Active' : 'Inactive'),
    ),
   )
  },
 },
 {
  id: 'actions',
  enableHiding: false,
  header: () => h('div', { class: 'text-center' }, 'Actions'),
  cell: ({ row }) => {
   return h(
    'div',
    { class: 'text-center' },
    h(MasterProductActions, {
     product: row.original,
     brands: brands.value || [],
     onSave: async (data) => {
      await saveMasterProduct(data)
     },
     onDelete: async (id) => {
      await removeMasterProduct(id)
     },
     onReactivate: async (id) => {
      await activateMasterProduct(id)
     },
    }),
   )
  },
 },
]
</script>

<template>
 <DataTable
  v-if="masterProducts"
  :columns="columns"
  :data="masterProducts"
  :config="tableConfig"
 >
  <template #top-table>
   <div class="flex items-center gap-3">
    <!-- Brand Filter -->
    <Select
     :model-value="selectedBrandId || 'all'"
     @update:model-value="handleBrandFilterChange"
    >
     <SelectTrigger class="w-48">
      <SelectValue placeholder="Filter by brand" />
     </SelectTrigger>
     <SelectContent>
      <SelectGroup>
       <SelectItem value="all">All Brands</SelectItem>
       <SelectItem v-for="brand in brands" :key="brand.id" :value="brand.id">
        {{ brand.name }}
       </SelectItem>
      </SelectGroup>
     </SelectContent>
    </Select>

    <!-- Article Code Filter (Server-side) -->
    <Input
     v-model="localArticleCodeFilter"
     class="w-48"
     placeholder="Search article code..."
    />

    <!-- EAN Code Filter (Server-side) -->
    <Input
     v-model="localEanCodeFilter"
     class="w-48"
     placeholder="Search EAN code..."
    />

    <!-- Description Filter (Server-side) -->
    <Input
     v-model="localDescriptionFilter"
     class="w-56"
     placeholder="Search description..."
    />

    <!-- CSV Upload -->
    <SharedSheet
     v-model:open="csvSheetOpen"
     title="Upload Master Products"
     description="Import products from a CSV file"
    >
     <template #trigger>
      <Button variant="outline">
       <Upload class="w-4 h-4 mr-2" />
       Upload CSV
      </Button>
     </template>
     <template #content="{ close }">
      <MasterProductCsvUpload
       v-if="!showPreview"
       :brands="brands || []"
       @preview="handleCsvPreview"
      />
      <MasterProductCsvPreview
       v-else-if="csvPreviewData"
       :preview-data="csvPreviewData"
       :is-applying="isApplyingCsv"
       :upload-progress="uploadProgress"
       @apply="
        async () => {
         await handleCsvApply()
         close()
        }
       "
       @back="handleCsvBack"
       @cancel="handleCsvCancel"
      />
     </template>
    </SharedSheet>

    <!-- Add Single Product -->
    <SharedSheet
     trigger-label="Add Product"
     title="Add New Product"
     description="Create a new master product"
    >
     <template #content="{ close }">
      <MasterProductEditForm
       :brands="brands || []"
       @save="
        async (product) => {
         await saveMasterProduct(product)
         close()
        }
       "
      />
     </template>
    </SharedSheet>
   </div>
  </template>
 </DataTable>
</template>

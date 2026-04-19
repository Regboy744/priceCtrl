<script setup lang="ts" generic="TData, TValue">
import type {
 ColumnDef,
 SortingState,
 ColumnFiltersState,
 VisibilityState,
} from '@tanstack/vue-table'
import {
 FlexRender,
 getCoreRowModel,
 useVueTable,
 getPaginationRowModel,
 getSortedRowModel,
 getFilteredRowModel,
} from '@tanstack/vue-table'

import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table'

import { Button } from '@/components/ui/button'
import { valueUpdater } from '@/components/ui/table/utils'
import { computed, ref } from 'vue'
import { Input } from '@/components/ui/input'

import {
 DropdownMenu,
 DropdownMenuCheckboxItem,
 DropdownMenuContent,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { ChevronDown } from 'lucide-vue-next'
import type { DataTableConfig } from '@/types/shared/custom.types'

// defineProps with withDefaults
const props = withDefaults(
 defineProps<{
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  config?: DataTableConfig
 }>(),
 {
  config: () => ({
   features: {
    rowSelection: true,
    pagination: true,
    sorting: true,
    filtering: true,
    columnVisibility: true,
   },
   pageSize: 20,
   searchColumn: 'name',
   searchPlaceholder: 'Search...',
  }),
 },
)

// Add computed to the props to track changes
// Computed config values with defaults
const features = computed(() => ({
 rowSelection: props.config?.features?.rowSelection ?? true,
 pagination: props.config?.features?.pagination ?? true,
 sorting: props.config?.features?.sorting ?? true,
 filtering: props.config?.features?.filtering ?? true,
 columnVisibility: props.config?.features?.columnVisibility ?? true,
}))

const pageSize = computed(() => props.config?.pageSize ?? 20)
const searchColumn = computed(() => props.config?.searchColumn ?? 'name')
const searchPlaceholder = computed(
 () => props.config?.searchPlaceholder ?? 'Search...',
)
const additionalFilters = computed(() => props.config?.additionalFilters ?? [])

const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})
const rowSelection = ref({})

const table = useVueTable({
 get data() {
  return props.data
 },
 get columns() {
  return props.columns
 },
 getCoreRowModel: getCoreRowModel(),
 getPaginationRowModel: getPaginationRowModel(),
 initialState: {
  pagination: {
   pageSize: pageSize.value,
  },
 },

 // Enables client-side sorting functionality
 // Processes and returns rows in sorted order based on current sorting state
 getSortedRowModel: getSortedRowModel(),

 // Handles changes to the sorting state when user clicks column headers
 // Updates the sorting ref with new sort direction/column
 onSortingChange: (updaterOrValue) => valueUpdater(updaterOrValue, sorting),

 // Handles changes to column filter values when user applies filters
 // Updates the columnFilters ref with new filter criteria
 onColumnFiltersChange: (updaterOrValue) =>
  valueUpdater(updaterOrValue, columnFilters),

 // Enables client-side filtering functionality
 // Processes and returns only rows that match current filter criteria
 getFilteredRowModel: getFilteredRowModel(),

 // Handles changes to column visibility when user shows/hides columns
 // Updates the columnVisibility ref to track which columns are displayed
 onColumnVisibilityChange: (updaterOrValue) =>
  valueUpdater(updaterOrValue, columnVisibility),

 // Handles changes to row selection when user checks/unchecks rows
 // Updates the rowSelection ref to track which rows are selected
 onRowSelectionChange: (updaterOrValue) =>
  valueUpdater(updaterOrValue, rowSelection),

 state: {
  get sorting() {
   return sorting.value
  },
  get columnFilters() {
   return columnFilters.value
  },
  get columnVisibility() {
   return columnVisibility.value
  },
  get rowSelection() {
   return rowSelection.value
  },
 },
})
</script>

<template>
 <div>
  <!-- TODO: Make the component responsive.  -->
  <!-- op toolbar: filtering + column visibility -->
  <div
   v-if="features.filtering || features.columnVisibility"
   class="flex items-center justify-between py-4 gap-4"
  >
   <!-- LEFT SIDE: Title + Slot -->
   <div class="flex items-center gap-4">
    <h2 class="text-lg font-semibold">Manage Companies</h2>
    <slot name="top-table" />
   </div>
   <!-- RIGHT SIDE: Search + Columns Dropdown -->
   <div class="flex items-center gap-2">
    <Input
     v-if="features.filtering"
     class="max-w-2xs"
     :placeholder="searchPlaceholder"
     :model-value="table.getColumn(searchColumn)?.getFilterValue() as string"
     @update:model-value="table.getColumn(searchColumn)?.setFilterValue($event)"
    />
    <Input
     v-for="filter in additionalFilters"
     :key="filter.column"
     class="max-w-2xs"
     :placeholder="filter.placeholder"
     :model-value="table.getColumn(filter.column)?.getFilterValue() as string"
     @update:model-value="
      table.getColumn(filter.column)?.setFilterValue($event)
     "
    />
    <DropdownMenu v-if="features.columnVisibility">
     <DropdownMenuTrigger as-child>
      <Button variant="outline" class="ml-auto">
       Columns
       <ChevronDown class="w-4 h-4 ml-2" />
      </Button>
     </DropdownMenuTrigger>
     <DropdownMenuContent align="end">
      <DropdownMenuCheckboxItem
       v-for="column in table
        .getAllColumns()
        .filter((column) => column.getCanHide())"
       :key="column.id"
       class="capitalize"
       :modelValue="column.getIsVisible()"
       @update:modelValue="
        (value) => {
         column.toggleVisibility(!!value)
        }
       "
      >
       {{ column.id }}
      </DropdownMenuCheckboxItem>
     </DropdownMenuContent>
    </DropdownMenu>
   </div>
  </div>
  <!-- Table -->
  <div class="border rounded-md max-h-[calc(75vh)] overflow-y-auto">
   <Table>
    <TableHeader class="bg-muted sticky top-0 z-10">
     <TableRow
      v-for="headerGroup in table.getHeaderGroups()"
      :key="headerGroup.id"
     >
      <TableHead v-for="header in headerGroup.headers" :key="header.id">
       <FlexRender
        v-if="!header.isPlaceholder"
        :render="header.column.columnDef.header"
        :props="header.getContext()"
       />
      </TableHead>
     </TableRow>
    </TableHeader>
    <TableBody>
     <template v-if="table.getRowModel().rows?.length">
      <TableRow
       v-for="row in table.getRowModel().rows"
       :key="row.id"
       :data-state="row.getIsSelected() ? 'selected' : undefined"
      >
       <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
        <FlexRender
         :render="cell.column.columnDef.cell"
         :props="cell.getContext()"
        />
       </TableCell>
      </TableRow>
     </template>
     <template v-else>
      <TableRow>
       <TableCell :colspan="columns.length" class="h-24 text-center">
        No results.
       </TableCell>
      </TableRow>
     </template>
    </TableBody>
   </Table>
  </div>

  <!-- Pagination -->
  <div
   v-if="features.pagination || features.rowSelection"
   class="flex items-center justify-end py-4 space-x-1"
  >
   <div
    v-if="features.rowSelection"
    class="flex-1 text-sm text-muted-foreground"
   >
    {{ table.getFilteredSelectedRowModel().rows.length }} of
    {{ table.getFilteredRowModel().rows.length }} row(s) selected.
   </div>
   <template v-if="features.pagination && props.data.length / pageSize > 1">
    <Button
     variant="outline"
     size="sm"
     :disabled="!table.getCanPreviousPage()"
     @click="table.previousPage()"
    >
     Previous
    </Button>
    <Button
     variant="outline"
     size="sm"
     :disabled="!table.getCanNextPage()"
     @click="table.nextPage()"
    >
     Next
    </Button>
   </template>
  </div>
 </div>
</template>

<style scoped>
td,
th {
 padding: 4px 4px;
}
td:first-child,
th:first-child {
 padding-left: 20px;
}
td:last-child,
th:last-child {
 padding-right: 20px;
}
</style>

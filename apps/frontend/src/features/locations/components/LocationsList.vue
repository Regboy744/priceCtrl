<script setup lang="ts">
import { h, computed, toRef } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import type { DataTableConfig } from '@/types/shared/custom.types'
import DataTable from '@/components/appDataTable/DataTable.vue'
import Button from '@/components/ui/button/Button.vue'
import { Badge } from '@/components/ui/badge'
import { ArrowUpDown, Store } from 'lucide-vue-next'
import { useLocations } from '@/features/locations/composables/useLocations'
import type { Location, LocationFormData } from '@/features/locations/types'
import LocationActions from '@/features/locations/components/LocationActions.vue'
import LocationEditForm from '@/features/locations/components/LocationEditForm.vue'
import SharedSheet from '@/components/shared/SharedSheet.vue'

interface Props {
 companyId: string
 readOnly?: boolean
 allowCredentials?: boolean
}

const props = withDefaults(defineProps<Props>(), {
 readOnly: false,
 allowCredentials: true,
})

const companyIdRef = toRef(props, 'companyId')
const { locations, fetchLocations, saveLocation, removeLocation } =
 useLocations(companyIdRef)

// Fetch locations on mount
await fetchLocations()

// Table config
const tableConfig: DataTableConfig = {
 features: {
  rowSelection: false,
  pagination: true,
  sorting: true,
  filtering: true,
  columnVisibility: true,
 },
 pageSize: 10,
 searchColumn: 'name',
 searchPlaceholder: 'Filter locations by name...',
}

// Format location type for display
const formatLocationType = (type: string) => {
 return type.charAt(0).toUpperCase() + type.slice(1)
}

const showActions = computed(() => !props.readOnly || props.allowCredentials)

// Table columns
const columns = computed<ColumnDef<Location>[]>(() => {
 const baseColumns: ColumnDef<Location>[] = [
  {
   accessorKey: 'location_number',
   header: ({ column }) => {
    return h(
     Button,
     {
      class: 'hover:bg-transparent hover:text-current',
      variant: 'ghost',
      onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
     },
     () => ['#', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })],
    )
   },
   cell: ({ row }) => {
    return h(
     'div',
     { class: 'text-center font-mono' },
     row.getValue('location_number'),
    )
   },
   enableSorting: true,
  },
  {
   accessorKey: 'name',
   header: ({ column }) => {
    return h(
     Button,
     {
      class: 'hover:bg-transparent hover:text-current',
      variant: 'ghost',
      onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
     },
     () => ['Name', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })],
    )
   },
   cell: ({ row }) => {
    return h('div', { class: 'text-left font-medium' }, row.getValue('name'))
   },
   enableSorting: true,
  },
  {
   accessorKey: 'location_type',
   header: () => h('div', { class: 'text-left' }, 'Type'),
   cell: ({ row }) => {
    const type = row.getValue('location_type') as string
    return h(
     Badge,
     { variant: type === 'store' ? 'default' : 'secondary' },
     () => formatLocationType(type),
    )
   },
  },
  {
   accessorKey: 'is_active',
   header: () => h('div', { class: 'text-left' }, 'Status'),
   cell: ({ row }) => {
    const isActive = row.getValue('is_active') as boolean
    return h(Badge, { variant: isActive ? 'default' : 'outline' }, () =>
     isActive ? 'Active' : 'Inactive',
    )
   },
  },
 ]

 if (!showActions.value) {
  return baseColumns
 }

 return [
  ...baseColumns,
  {
   id: 'actions',
   enableHiding: false,
   header: () => h('div', { class: 'text-center' }, 'Actions'),
   cell: ({ row }) => {
    return h(
     'div',
     { class: 'text-center' },
     h(LocationActions, {
      location: row.original,
      readOnly: props.readOnly,
      allowCredentials: props.allowCredentials,
      onSave: async (data) => {
       await saveLocation(data)
      },
      onDelete: async (id) => {
       await removeLocation(id)
      },
     }),
    )
   },
  },
 ]
})

// Handle save from the "Add" button
async function handleSave(data: LocationFormData) {
 await saveLocation(data)
}

const hasLocations = computed(() => locations.value.length > 0)
</script>

<template>
 <div>
  <!-- Empty state -->
  <div
   v-if="!hasLocations"
   class="flex flex-col items-center justify-center py-12 text-center"
  >
   <Store class="h-12 w-12 text-muted-foreground mb-4" />
   <h3 class="text-lg font-medium">No locations yet</h3>
   <p class="text-sm text-muted-foreground mb-4">
    Add your first store or office location
   </p>
   <SharedSheet
    v-if="!readOnly"
    trigger-label="Add First Location"
    title="Add New Location"
    description="Create a new location for this company"
   >
    <template #content="{ close }">
     <LocationEditForm
      @save="
       async (data) => {
        await handleSave(data)
        close()
       }
      "
     />
    </template>
   </SharedSheet>
  </div>

  <!-- Locations table -->
  <DataTable v-else :columns="columns" :data="locations" :config="tableConfig">
   <template #top-table>
    <SharedSheet
     v-if="!readOnly"
     trigger-label="Add Location"
     title="Add New Location"
     description="Create a new location for this company"
    >
     <template #content="{ close }">
      <LocationEditForm
       @save="
        async (data) => {
         await handleSave(data)
         close()
        }
       "
      />
     </template>
    </SharedSheet>
   </template>
  </DataTable>
 </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import type { DataTableConfig } from '@/types/shared/custom.types'
import { RouterLink } from 'vue-router'
import DataTable from '@/components/appDataTable/DataTable.vue'
import Button from '@/components/ui/button/Button.vue'
import { ArrowUpDown } from 'lucide-vue-next'
import type { CompaniesType } from '@/features/companies/api/queries'
import CompanyActions from '@/features/companies/components/CompanyActions.vue'
import CompanyEditForm from '@/features/companies/components/CompanyEditForm.vue'
import { useCompanies } from '@/features/companies/composables/useCompanies'
import SharedSheet from '@/components/shared/SharedSheet.vue'

const { companies, fetchCompanies, saveCompany, removeCompany } = useCompanies()

definePage({
 meta: {
  allowedRoles: ['master'],
 },
})

// Fetch the companies through the useCompanies composable
await fetchCompanies()

// Table config
const tableConfig: DataTableConfig = {
 features: {
  rowSelection: false,
  pagination: true,
  sorting: true,
  filtering: true,
  columnVisibility: true,
 },
 pageSize: 20,
 searchColumn: 'name',
 searchPlaceholder: 'Filter companies by name ...',
}

// Table columns
const columns: ColumnDef<CompaniesType[0]>[] = [
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
   return h(
    RouterLink,
    {
     to: `/app/companies/${row.original.id}`,
     class: 'text-left font-medium block w-full py-2.5 px-4 -my-2.5 -mx-4',
    },
    () => row.getValue('name'),
   )
  },
  enableSorting: true,
  enableHiding: true,
 },
 {
  accessorKey: 'brands',
  header: () => h('div', { class: 'text-left' }, 'Brand'),
  cell: ({ row }) => {
   const brand = row.original.brands
   return h('div', { class: 'text-left font-medium' }, brand?.name || '-')
  },
 },
 {
  accessorKey: 'phone',
  header: () => h('div', { class: 'text-left' }, 'Phone'),
  cell: ({ row }) => {
   return h('div', { class: 'text-left font-medium' }, row.getValue('phone'))
  },
 },
 {
  accessorKey: 'email',
  header: () => h('div', { class: 'text-left' }, 'Email'),
  cell: ({ row }) => {
   return h('div', { class: 'text-left font-medium' }, row.getValue('email'))
  },
 },
 {
  accessorKey: 'is_active',
  header: () => h('div', { class: 'text-left' }, 'Status'),
  cell: ({ row }) => {
   const status = row.getValue('is_active') === true ? 'Active' : 'Inactive'
   return h('div', { class: 'text-left font-medium' }, status)
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
    h(CompanyActions, {
     company: row.original,
     onSave: async (data) => {
      await saveCompany(data)
     },
     onDelete: async (id) => {
      await removeCompany(id)
     },
    }),
   )
  },
 },
]
</script>

<template>
 <DataTable
  v-if="companies"
  :columns="columns"
  :data="companies"
  :config="tableConfig"
 >
  <template #top-table>
   <SharedSheet
    trigger-label="New Company"
    title="Add New Company"
    description="Create a new company in the system"
   >
    <!-- Pass the component here -->
    <template #content="{ close }">
     <CompanyEditForm
      @save="
       async (company) => {
        await saveCompany(company)
        close()
       }
      "
     />
    </template>
   </SharedSheet>
  </template>
 </DataTable>
</template>

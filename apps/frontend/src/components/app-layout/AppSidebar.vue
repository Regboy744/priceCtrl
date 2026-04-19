<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SidebarProps } from '@/components/ui/sidebar'

import {
 Store,
 Euro,
 ReceiptText,
 Tags,
 Building2,
 ShoppingCart,
 Truck,
 Package,
 Users,
} from 'lucide-vue-next'
import NavFlat from '@/components/app-layout/NavFlat.vue'
import NavUser from '@/components/app-layout/NavUser.vue'
import { useAuthStore } from '@/stores/auth'
import { usePermissions } from '@/composables/auth/usePermissions'
import { apiClient } from '@/lib/apiClient'

import {
 Sidebar,
 SidebarContent,
 SidebarFooter,
 SidebarHeader,
 SidebarMenu,
 SidebarMenuButton,
 SidebarMenuItem,
 SidebarRail,
} from '@/components/ui/sidebar'

const props = withDefaults(defineProps<SidebarProps>(), {
 collapsible: 'icon',
 variant: 'inset',
})

const authStore = useAuthStore()
const { hasPermission, hasRole } = usePermissions()

const companyName = ref<string | null>(null)
const locationName = ref<string | null>(null)

let contextRequestId = 0

const loadTenantContext = async () => {
 const role = authStore.userRole
 const companyId = authStore.companyId
 const locationId = authStore.locationId
 const requestId = ++contextRequestId

 if (role === 'master') {
  companyName.value = null
  locationName.value = null
  return
 }

 if (role === 'manager' && locationId) {
  const res = await apiClient.get<{
   name: string
   location_number: number | null
   company: { id: string; name: string } | null
  }>(`/locations/${encodeURIComponent(locationId)}?withCompany=true`)

  if (requestId !== contextRequestId) return

  if (res.success && res.data) {
   const locationData = res.data
   companyName.value = locationData.company?.name ?? null
   locationName.value =
    locationData.location_number !== null
     ? `#${locationData.location_number} - ${locationData.name}`
     : locationData.name
   return
  }
 }

 if (companyId) {
  const res = await apiClient.get<{ name: string }>(
   `/companies/${encodeURIComponent(companyId)}`,
  )

  if (requestId !== contextRequestId) return

  companyName.value = res.success && res.data?.name ? res.data.name : null
 } else {
  companyName.value = null
 }

 locationName.value = null
}

watch(
 [
  () => authStore.userRole,
  () => authStore.companyId,
  () => authStore.locationId,
 ],
 () => {
  void loadTenantContext()
 },
 { immediate: true },
)

const companyLink = computed(() => {
 if (authStore.userRole === 'master') return '/app/companies'
 if (authStore.companyId) return `/app/companies/${authStore.companyId}`
 return null
})

const data = {
 user: {
  name: 'User',
  email: 'm@example.com',
  avatar: '/avatars/shadcn.jpg',
 },
}

const contextTitle = computed(() => {
 if (authStore.userRole === 'master') {
  return 'Master Mode'
 }

 return companyName.value || 'Price Ctrl'
})

const contextSubtitle = computed(() => {
 if (authStore.userRole === 'manager') {
  return locationName.value || 'Location not linked'
 }

 return null
})

const sidebarAriaLabel = computed(() => {
 if (authStore.userRole === 'master') {
  return 'Master mode context'
 }

 if (contextSubtitle.value) {
  return `${contextTitle.value}, ${contextSubtitle.value}`
 }

 return contextTitle.value
})

const navItems = computed(() => {
 const items = [
  { title: 'Big Deals', to: '/app', icon: Tags },
  { title: 'Price Check', to: '/app/price-check', icon: Euro },
  { title: 'Orders', to: '/app/orders', icon: ShoppingCart },
 ]

 if (companyLink.value) {
  items.push({
   title: hasRole('master') ? 'Companies' : 'Company',
   to: companyLink.value,
   icon: Building2,
  })
 }

 if (hasPermission('suppliers:write')) {
  items.push({ title: 'Suppliers', to: '/app/suppliers', icon: Truck })
 }

 if (hasRole('master')) {
  items.push({
   title: 'Master Products',
   to: '/app/masterProducts',
   icon: Package,
  })
 }

 if (hasPermission('user_profiles:read')) {
  items.push({ title: 'Users', to: '/app/users', icon: Users })
 }

 items.push({ title: 'Invoices', to: '#', icon: ReceiptText })

 return items
})
</script>

<template>
 <Sidebar v-bind="props">
  <SidebarHeader>
   <SidebarMenu>
    <SidebarMenuItem>
     <SidebarMenuButton
      size="lg"
      class="pointer-events-none"
      :aria-label="sidebarAriaLabel"
     >
      <div
       class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
      >
       <Store class="size-4" />
      </div>
      <div
       class="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden"
      >
       <span class="truncate text-base font-semibold">{{ contextTitle }}</span>
       <span
        v-if="contextSubtitle"
        class="truncate text-xs text-muted-foreground"
       >
        {{ contextSubtitle }}
       </span>
      </div>
     </SidebarMenuButton>
    </SidebarMenuItem>
   </SidebarMenu>
  </SidebarHeader>
  <SidebarContent>
   <NavFlat :items="navItems" />
  </SidebarContent>
  <SidebarFooter>
   <NavUser :user="data.user" />
  </SidebarFooter>
  <SidebarRail />
 </Sidebar>
</template>

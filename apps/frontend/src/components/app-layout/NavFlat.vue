<script setup lang="ts">
import type { LucideIcon } from 'lucide-vue-next'
import {
 SidebarGroup,
 SidebarMenu,
 SidebarMenuButton,
 SidebarMenuItem,
} from '@/components/ui/sidebar'

interface NavItem {
 title: string
 to: string
 icon?: LucideIcon
}

defineProps<{
 items: NavItem[]
}>()
</script>

<template>
 <SidebarGroup>
  <SidebarMenu>
   <SidebarMenuItem v-for="item in items" :key="item.title">
    <SidebarMenuButton
     as-child
     size="default"
     :tooltip="item.title"
     :isActive="$route.path === item.to"
    >
     <RouterLink :to="item.to">
      <component :is="item.icon" v-if="item.icon" stroke-width="2" />
      <span>{{ item.title }}</span>
     </RouterLink>
    </SidebarMenuButton>
   </SidebarMenuItem>
  </SidebarMenu>
 </SidebarGroup>
</template>

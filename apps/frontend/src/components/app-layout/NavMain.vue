<script setup lang="ts">
import type { LucideIcon } from 'lucide-vue-next'
import { ChevronRight } from 'lucide-vue-next'
import {
 Collapsible,
 CollapsibleContent,
 CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
 SidebarGroup,
 SidebarGroupLabel,
 SidebarMenu,
 SidebarMenuButton,
 SidebarMenuItem,
 SidebarMenuSub,
 SidebarMenuSubButton,
 SidebarMenuSubItem,
} from '@/components/ui/sidebar'

interface linkProp {
 title: string
 to: string
 icon?: LucideIcon
 isActive?: boolean
 items?: {
  title: string
  to: string
 }[]
}

defineProps<{
 navMain: linkProp[]
}>()
</script>

<template>
 <SidebarGroup>
  <SidebarGroupLabel>Store</SidebarGroupLabel>
  <SidebarMenu>
   <Collapsible
    v-for="item in navMain"
    :key="item.title"
    as-child
    :default-open="item.isActive"
    class="group/collapsible"
   >
    <SidebarMenuItem>
     <CollapsibleTrigger as-child>
      <SidebarMenuButton size="default" :tooltip="item.title">
       <component :is="item.icon" v-if="item.icon" stroke-width="2" />
       <span>{{ item.title }}</span>
       <ChevronRight
        class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
       />
      </SidebarMenuButton>
     </CollapsibleTrigger>
     <CollapsibleContent>
      <SidebarMenuSub>
       <SidebarMenuSubItem v-for="subItem in item.items" :key="subItem.title">
        <SidebarMenuSubButton as-child :isActive="$route.path === subItem.to">
         <RouterLink :to="subItem.to">
          {{ subItem.title }}
         </RouterLink>
        </SidebarMenuSubButton>
       </SidebarMenuSubItem>
      </SidebarMenuSub>
     </CollapsibleContent>
    </SidebarMenuItem>
   </Collapsible>
  </SidebarMenu>
 </SidebarGroup>
</template>

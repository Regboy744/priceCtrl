<script setup lang="ts">
import AppSidebar from '@/components/app-layout/AppSidebar.vue'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

import AppHeader from '@/components/app-layout/AppHeader.vue'
//import { usePageMeta } from '@/composables/shared/usePageMeta'

//const { title } = usePageMeta()
</script>

<template>
 <div>
  <SidebarProvider>
   <AppSidebar />
   <SidebarInset>
    <AppHeader />
    <main class="flex flex-col flex-1 p-4 gap-4 pt-0">
     <!-- <div class="flex items-center"> -->
     <!--  <h1 class="text-lg font-semibold md:text-2xl">{{ title }}</h1> -->
     <!-- </div> -->
     <slot />
    </main>
   </SidebarInset>
  </SidebarProvider>
 </div>
</template>

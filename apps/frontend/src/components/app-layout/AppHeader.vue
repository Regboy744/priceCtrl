<template>
 <div>
  <header
   class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12"
  >
   <div class="flex flex-1 items-center gap-2 px-4">
    <SidebarTrigger class="-ml-1" />
    <Separator orientation="vertical" class="mr-2 h-4" />
    <Breadcrumb>
     <BreadcrumbList>
      <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
       <BreadcrumbItem
        :class="{
         'hidden md:inline-flex': index > 0 && index < breadcrumbs.length - 1,
        }"
       >
        <BreadcrumbLink
         v-if="index < breadcrumbs.length - 1"
         :href="crumb.path"
        >
         {{ crumb.label }}
        </BreadcrumbLink>
        <BreadcrumbPage v-else>
         {{ crumb.label }}
        </BreadcrumbPage>
       </BreadcrumbItem>
       <BreadcrumbSeparator
        v-if="index < breadcrumbs.length - 1"
        :class="{
         'hidden md:inline-flex': index > 0 && index < breadcrumbs.length - 1,
        }"
       />

       <!-- add Ellipsis on mobile  -->
       <BreadcrumbEllipsis
        v-if="index === 0 && breadcrumbs.length > 2"
        class="md:hidden"
       />
       <BreadcrumbSeparator
        v-if="index === 0 && breadcrumbs.length > 2"
        class="md:hidden"
       />
      </template>
     </BreadcrumbList>
    </Breadcrumb>
   </div>
   <div class="ml-auto px-4 flex items-center gap-2">
    <WarningsBell />
    <ThemeToggle />
   </div>
  </header>
 </div>
</template>

<script setup lang="ts">
import {
 Breadcrumb,
 BreadcrumbItem,
 BreadcrumbLink,
 BreadcrumbList,
 BreadcrumbPage,
 BreadcrumbSeparator,
 BreadcrumbEllipsis,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { usePageMeta } from '@/composables/shared/usePageMeta'
import ThemeToggle from '@/components/shared/ThemeToggle.vue'
import WarningsBell from '@/components/app-layout/WarningsBell.vue'

//Breadcrumb automation
const { breadcrumbs } = usePageMeta()
</script>

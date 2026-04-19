<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
 Bell,
 ChevronsUpDown,
 CreditCard,
 LogOut,
 Settings,
 Sparkles,
 Shield,
} from 'lucide-vue-next'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuGroup,
 DropdownMenuItem,
 DropdownMenuLabel,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
 SidebarMenu,
 SidebarMenuButton,
 SidebarMenuItem,
 useSidebar,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth'
import { useErrorStore } from '@/stores/error'

const router = useRouter()
const authStore = useAuthStore()
const errorStore = useErrorStore()
const { isMobile } = useSidebar()

// User data from auth store
const userName = computed(() => authStore.userFullName)
const userEmail = computed(() => authStore.userEmail)
const userAvatar = computed(() => authStore.userAvatar)
const userInitials = computed(() => authStore.userInitials)
const userRole = computed(() => authStore.userRole)

// Role badge styling
const roleBadgeClass = computed(() => {
 switch (userRole.value) {
  case 'master':
   return 'bg-chart-4/10 text-chart-4 border-chart-4/20'
  case 'admin':
   return 'bg-primary/10 text-primary border-primary/20'
  case 'manager':
   return 'bg-success/10 text-success border-success/20'
  default:
   return 'bg-muted text-muted-foreground border-border'
 }
})

// Handle logout
const handleLogout = async () => {
 await authStore.signOut()
 router.push('/auth/login')
}

// Navigate to company settings
const handleSettings = () => {
 const companyId = authStore.companyId
 if (!companyId) {
  errorStore.setError({
   error: 'Your account is not linked to a company.',
   customCode: 403,
  })
  router.push('/app/companies/error/no-company')
  return
 }

 router.push(`/app/companies/${companyId}`)
}

// Navigate to billing
const handleBilling = () => {
 router.push('/app/settings/billing')
}

// Navigate to notifications
const handleNotifications = () => {
 router.push('/app/settings/notifications')
}

// Navigate to upgrade/billing
const handleUpgrade = () => {
 router.push('/app/settings/billing')
}
</script>

<template>
 <SidebarMenu>
  <SidebarMenuItem>
   <DropdownMenu>
    <DropdownMenuTrigger as-child>
     <SidebarMenuButton
      size="lg"
      class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
     >
      <Avatar class="h-8 w-8 rounded-lg">
       <AvatarImage :src="userAvatar" :alt="userName" />
       <AvatarFallback class="rounded-lg bg-primary/10 text-primary">
        {{ userInitials }}
       </AvatarFallback>
      </Avatar>
      <div class="grid flex-1 text-left text-sm leading-tight">
       <span class="truncate font-medium">{{ userName }}</span>
       <span class="truncate text-xs text-muted-foreground">{{
        userEmail
       }}</span>
      </div>
      <ChevronsUpDown class="ml-auto size-4" />
     </SidebarMenuButton>
    </DropdownMenuTrigger>
    <DropdownMenuContent
     class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-lg"
     :side="isMobile ? 'bottom' : 'right'"
     align="end"
     :side-offset="4"
    >
     <DropdownMenuLabel class="p-0 font-normal">
      <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
       <Avatar class="h-8 w-8 rounded-lg">
        <AvatarImage :src="userAvatar" :alt="userName" />
        <AvatarFallback class="rounded-lg bg-primary/10 text-primary">
         {{ userInitials }}
        </AvatarFallback>
       </Avatar>
       <div class="grid flex-1 text-left text-sm leading-tight">
        <div class="flex items-center gap-2">
         <span class="truncate font-semibold">{{ userName }}</span>
         <Badge
          v-if="userRole"
          variant="outline"
          class="text-[10px] px-1.5 py-0 h-4 capitalize"
          :class="roleBadgeClass"
         >
          <Shield class="w-2.5 h-2.5 mr-0.5" />
          {{ userRole }}
         </Badge>
        </div>
        <span class="truncate text-xs text-muted-foreground">{{
         userEmail
        }}</span>
       </div>
      </div>
     </DropdownMenuLabel>
     <DropdownMenuSeparator />
     <DropdownMenuGroup>
      <DropdownMenuItem class="cursor-pointer" @click="handleUpgrade">
       <Sparkles class="mr-2 h-4 w-4" />
       Upgrade to Pro
      </DropdownMenuItem>
     </DropdownMenuGroup>
     <DropdownMenuSeparator />
     <DropdownMenuGroup>
      <DropdownMenuItem class="cursor-pointer" @click="handleSettings">
       <Settings class="mr-2 h-4 w-4" />
       Settings
      </DropdownMenuItem>
      <DropdownMenuItem class="cursor-pointer" @click="handleBilling">
       <CreditCard class="mr-2 h-4 w-4" />
       Billing
      </DropdownMenuItem>
      <DropdownMenuItem class="cursor-pointer" @click="handleNotifications">
       <Bell class="mr-2 h-4 w-4" />
       Notifications
      </DropdownMenuItem>
     </DropdownMenuGroup>
     <DropdownMenuSeparator />
     <DropdownMenuItem
      class="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
      @click="handleLogout"
     >
      <LogOut class="mr-2 h-4 w-4" />
      Log out
     </DropdownMenuItem>
    </DropdownMenuContent>
   </DropdownMenu>
  </SidebarMenuItem>
 </SidebarMenu>
</template>

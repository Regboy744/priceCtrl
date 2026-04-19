<script setup lang="ts">
import { computed } from 'vue'
import type { CredentialIssueRow } from '@/features/dashboard/types'
import { useWarningsStore } from '@/stores/warnings'
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuLabel,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bell, AlertCircle } from 'lucide-vue-next'

const warningsStore = useWarningsStore()

const issues = computed(() => warningsStore.credentialIssues)
const issueCount = computed(() => issues.value.length)
const topIssues = computed(() => issues.value.slice(0, 5))
const hasIssues = computed(() => issueCount.value > 0)
const badgeText = computed(() =>
 issueCount.value > 9 ? '9+' : issueCount.value,
)

const statusBadge = (status: CredentialIssueRow['status']) => {
 if (status === 'failed') {
  return { variant: 'destructive' as const, class: '' }
 }

 if (status === 'expired' || status === 'pending') {
  return {
   variant: 'outline' as const,
   class:
    'border-chart-1/25 bg-chart-1/10 text-chart-1 dark:border-chart-3/25 dark:bg-chart-3/10 dark:text-chart-3',
  }
 }

 if (status === 'unknown') {
  return {
   variant: 'outline' as const,
   class: 'border-border/60 bg-muted/20 text-muted-foreground',
  }
 }

 return {
  variant: 'secondary' as const,
  class: 'bg-muted/30 text-muted-foreground',
 }
}
</script>

<template>
 <DropdownMenu>
  <DropdownMenuTrigger as-child>
   <Button variant="ghost" size="icon" class="relative" aria-label="Warnings">
    <Bell class="h-4 w-4" />
    <span
     v-if="hasIssues"
     class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center"
    >
     {{ badgeText }}
    </span>
   </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" :side-offset="8" class="w-80">
   <DropdownMenuLabel class="flex items-center justify-between">
    <span>Warnings</span>
    <Badge variant="outline" class="text-xs"> {{ issueCount }} issues </Badge>
   </DropdownMenuLabel>
   <DropdownMenuItem class="text-xs text-muted-foreground" disabled>
    Things that may block savings
   </DropdownMenuItem>
   <DropdownMenuSeparator />

   <DropdownMenuItem v-if="!hasIssues" disabled>
    <div class="flex items-start gap-2">
     <AlertCircle class="mt-0.5 h-4 w-4 text-muted-foreground" />
     <div class="text-xs text-muted-foreground">
      No blockers detected. Supplier logins look healthy.
     </div>
    </div>
   </DropdownMenuItem>

   <template v-else>
    <DropdownMenuItem
     v-for="issue in topIssues"
     :key="issue.id"
     class="flex items-start justify-between gap-3"
    >
     <div class="min-w-0">
      <div class="text-sm font-medium truncate">
       {{ issue.supplierName }}
      </div>
      <div class="text-xs text-muted-foreground truncate">
       {{ issue.companyName }}
      </div>
      <div class="text-xs text-muted-foreground truncate">
       {{ issue.locationNumber ? `#${issue.locationNumber} · ` : '' }}
       {{ issue.locationName }}
      </div>
      <div
       v-if="issue.lastErrorMessage"
       class="text-xs text-muted-foreground truncate"
      >
       {{ issue.lastErrorMessage }}
      </div>
     </div>
     <Badge
      :variant="statusBadge(issue.status).variant"
      class="text-xs"
      :class="statusBadge(issue.status).class"
     >
      {{ issue.status }}
     </Badge>
    </DropdownMenuItem>

    <DropdownMenuItem
     v-if="issueCount > topIssues.length"
     class="text-xs text-muted-foreground"
     disabled
    >
     +{{ issueCount - topIssues.length }} more issues
    </DropdownMenuItem>
   </template>
  </DropdownMenuContent>
 </DropdownMenu>
</template>

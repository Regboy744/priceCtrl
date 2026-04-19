<script setup lang="ts">
import { computed } from 'vue'
import type {
 DashboardAlerts,
 CredentialIssueRow,
} from '@/features/dashboard/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, KeyRound } from 'lucide-vue-next'

interface Props {
 alerts: DashboardAlerts
 isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
 isLoading: false,
})

const credentialIssueCount = computed(
 () => props.alerts.credentialIssues.length,
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

const countBadgeClass = (count: number, tone: 'ok' | 'warn'): string => {
 if (count === 0) {
  return 'border-chart-2/25 bg-chart-2/12 text-chart-2'
 }

 if (tone === 'warn') {
  return 'border-chart-1/25 bg-chart-1/12 text-chart-1 dark:border-chart-3/25 dark:bg-chart-3/12 dark:text-chart-3'
 }

 return 'border-border/60 bg-muted/30 text-muted-foreground'
}
</script>

<template>
 <Card
  id="alerts-panel"
  class="overflow-hidden bg-gradient-to-br from-card via-card to-muted/20"
 >
  <CardHeader
   class="flex flex-row items-center justify-between space-y-0 border-b border-border/50 pb-4"
  >
   <div>
    <CardTitle class="text-lg">Alerts</CardTitle>
    <p class="text-sm text-muted-foreground">Things that may block savings</p>
   </div>
   <div
    class="h-9 w-9 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-center"
   >
    <AlertCircle class="h-4 w-4 text-muted-foreground" />
   </div>
  </CardHeader>
  <CardContent>
   <div v-if="isLoading" class="space-y-3">
    <Skeleton class="h-5 w-48" />
    <Skeleton class="h-24 w-full" />
    <Skeleton class="h-5 w-48" />
    <Skeleton class="h-24 w-full" />
   </div>

   <div v-else>
    <!-- Supplier credential health -->
    <div class="space-y-3">
     <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
       <div
        class="h-9 w-9 rounded-lg border border-chart-2/25 bg-chart-2/12 text-chart-2 flex items-center justify-center"
       >
        <KeyRound class="h-4 w-4" />
       </div>
       <h4 class="text-sm font-semibold">Supplier Logins</h4>
      </div>
      <Badge
       variant="outline"
       class="text-xs"
       :class="countBadgeClass(credentialIssueCount, 'warn')"
      >
       {{ credentialIssueCount }} issues
      </Badge>
     </div>

     <div
      v-if="credentialIssueCount === 0"
      class="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground"
     >
      All supplier logins look healthy.
     </div>

     <div v-else class="rounded-lg border border-border/60 divide-y">
      <div
       v-for="issue in alerts.credentialIssues.slice(0, 6)"
       :key="issue.id"
       class="p-4 flex items-start justify-between gap-3 hover:bg-muted/10 transition-colors"
      >
       <div class="min-w-0">
        <div class="font-medium truncate">{{ issue.supplierName }}</div>
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
       <div class="flex flex-col items-end gap-1 shrink-0">
        <Badge
         :variant="statusBadge(issue.status).variant"
         class="text-xs"
         :class="statusBadge(issue.status).class"
        >
         {{ issue.status }}
        </Badge>
        <span class="text-xs text-muted-foreground">
         {{
          issue.lastLoginAt
           ? new Date(issue.lastLoginAt).toLocaleString('en-IE')
           : '-'
         }}
        </span>
       </div>
      </div>
      <div
       v-if="alerts.credentialIssues.length > 6"
       class="p-3 text-xs text-muted-foreground text-center"
      >
       Showing first 6 of {{ alerts.credentialIssues.length }} issues
      </div>
     </div>
    </div>
   </div>
  </CardContent>
 </Card>
</template>

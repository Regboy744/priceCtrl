<script setup lang="ts">
import { computed } from 'vue'
import type { DashboardKpis } from '@/features/dashboard/types'
import KpiCard from '@/components/shared/KpiCard.vue'
import { formatCurrency, formatPercent } from '@/lib/utils/currency'
import { Euro, Percent, TrendingDown } from 'lucide-vue-next'

interface Props {
 kpis: DashboardKpis
 isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
 isLoading: false,
})

const savedTone = computed(() =>
 props.kpis.savedTotal > 0 ? 'success' : 'neutral',
)
const savingsRateTone = computed(() =>
 props.kpis.savingsRate > 0 ? 'warning' : 'neutral',
)
</script>

<template>
 <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  <KpiCard
   title="Total Spend"
   :icon="Euro"
   tone="neutral"
   :loading="isLoading"
   :value="formatCurrency(kpis.spendTotal)"
   :description="`${kpis.ordersCount} orders · Avg ${formatCurrency(kpis.avgOrderValue)}`"
  />
  <KpiCard
   title="Saved"
   :icon="TrendingDown"
   :tone="savedTone"
   :loading="isLoading"
   :value="formatCurrency(kpis.savedTotal)"
   description="Savings vs baseline"
  />
  <KpiCard
   title="Savings Rate"
   :icon="Percent"
   :tone="savingsRateTone"
   :loading="isLoading"
   :value="formatPercent(kpis.savingsRate)"
   description="Saved / baseline"
  />
  <KpiCard
   title="Custom KPI"
   :loading="isLoading"
   value="—"
   description="Reserved for a future metric"
  />
 </div>
</template>

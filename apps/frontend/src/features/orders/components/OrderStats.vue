<script setup lang="ts">
import { computed } from 'vue'
import KpiCard from '@/components/shared/KpiCard.vue'
import { formatCurrency } from '@/lib/utils/currency'
import { ShoppingCart, Euro, TrendingDown, BarChart3 } from 'lucide-vue-next'
import type { OrderStats } from '@/features/orders/types'

interface Props {
 stats: OrderStats
 isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
 isLoading: false,
})

const savedTone = computed(() =>
 props.stats.totalSaved > 0 ? 'success' : 'neutral',
)
</script>

<template>
 <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  <KpiCard
   title="Total Orders"
   :icon="ShoppingCart"
   tone="neutral"
   :loading="isLoading"
   :value="stats.totalOrders"
   description="Orders in selected period"
  />
  <KpiCard
   title="Total Amount"
   :icon="Euro"
   tone="neutral"
   :loading="isLoading"
   :value="formatCurrency(stats.totalAmount)"
   description="Sum of all order totals"
  />
  <KpiCard
   title="Total Saved"
   :icon="TrendingDown"
   :tone="savedTone"
   :loading="isLoading"
   :value="formatCurrency(stats.totalSaved)"
   description="Savings vs baseline prices"
  />
  <KpiCard
   title="Avg Order Value"
   :icon="BarChart3"
   tone="neutral"
   :loading="isLoading"
   :value="formatCurrency(stats.avgOrderValue)"
   description="Average per order"
  />
 </div>
</template>

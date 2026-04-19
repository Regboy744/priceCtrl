<script setup lang="ts">
import { computed } from 'vue'
import type { SupplierSummaryRow } from '@/features/dashboard/types'
import type { ChartConfig } from '@/components/ui/chart'
import {
 VisAxis,
 VisLine,
 VisScatter,
 VisStackedBar,
 VisXYContainer,
} from '@unovis/vue'
import {
 ChartContainer,
 ChartCrosshair,
 ChartLegendContent,
 ChartTooltip,
 ChartTooltipContent,
 componentToString,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart3 } from 'lucide-vue-next'
import { formatCurrency } from '@/lib/utils/currency'

interface Props {
 data: SupplierSummaryRow[]
 isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
 isLoading: false,
})

const chartConfig = {
 netSpend: {
  label: 'Net Spend',
  color: 'var(--primary)',
 },
 saved: {
  label: 'Saved',
  color: 'var(--success)',
 },
 orders: {
  label: 'Orders',
  color: 'var(--info)',
 },
} satisfies ChartConfig

type ChartDataRow = {
 supplier: string
 netSpend: number
 saved: number
 orders: number
 /** Orders scaled to the currency axis range */
 ordersScaled: number
}

/**
 * Scale the orders count to sit within the currency axis range.
 * This lets us overlay a line on the same Y-axis without a second axis.
 * The max scaled value will be ~40% of the max bar height so it doesn't
 * visually dominate the bars.
 */
const chartData = computed<ChartDataRow[]>(() => {
 const rows = props.data
 if (rows.length === 0) return []

 const maxSpend = Math.max(...rows.map((r) => r.spendTotal), 1)
 const maxOrders = Math.max(...rows.map((r) => r.ordersCount), 1)
 const scaleFactor = (maxSpend * 0.4) / maxOrders

 return rows.map((row) => ({
  supplier: row.supplierName,
  netSpend: Math.round((row.spendTotal - row.savedTotal) * 100) / 100,
  saved: Math.round(row.savedTotal * 100) / 100,
  orders: row.ordersCount,
  ordersScaled: Math.round(row.ordersCount * scaleFactor * 100) / 100,
 }))
})

const hasData = computed(() => props.data.length > 0)

const tooltipTemplate = computed(() => {
 return componentToString(chartConfig, ChartTooltipContent, {
  labelFormatter: (d: number | Date) => {
   const idx = typeof d === 'number' ? d : 0
   return chartData.value[idx]?.supplier ?? ''
  },
 })
})

const formatAxisValue = (d: number): string => {
 if (d === 0) return '0'
 if (d >= 1_000_000) return `${(d / 1_000_000).toFixed(1)}M`
 if (d >= 1_000) return `${(d / 1_000).toFixed(0)}k`
 return formatCurrency(d)
}
</script>

<template>
 <Card class="overflow-hidden bg-gradient-to-br from-card via-card to-muted/20">
  <CardHeader
   class="flex flex-row items-center justify-between space-y-0 border-b border-border/50 pb-4"
  >
   <div>
    <CardTitle class="text-lg">Supplier Performance</CardTitle>
    <p class="text-sm text-muted-foreground">
     Spend, savings and order volume by supplier
    </p>
   </div>
   <div
    class="h-9 w-9 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-center"
   >
    <BarChart3 class="h-4 w-4 text-muted-foreground" />
   </div>
  </CardHeader>
  <CardContent>
   <div v-if="isLoading" class="space-y-3">
    <Skeleton class="h-9 w-40" />
    <Skeleton class="h-[350px] w-full" />
   </div>

   <div v-else-if="!hasData" class="py-10 text-center">
    <p class="text-sm text-muted-foreground">
     No supplier data in this period.
    </p>
   </div>

   <ChartContainer v-else :config="chartConfig" class="min-h-[350px] w-full">
    <VisXYContainer
     :data="chartData"
     :padding="{ top: 20, left: 10, right: 10 }"
    >
     <!-- Stacked bars: netSpend (bottom) + saved (top) = total spend -->
     <VisStackedBar
      :x="(_d: ChartDataRow, i: number) => i"
      :y="[(d: ChartDataRow) => d.netSpend, (d: ChartDataRow) => d.saved]"
      :color="[chartConfig.netSpend.color, chartConfig.saved.color]"
      :rounded-corners="4"
      :bar-padding="0.35"
     />

     <!-- Orders line (scaled to currency axis) -->
     <VisLine
      :x="(_d: ChartDataRow, i: number) => i"
      :y="(d: ChartDataRow) => d.ordersScaled"
      :color="chartConfig.orders.color"
      :line-width="2"
      curve-type="basis"
     />

     <!-- Dots on the line for clarity -->
     <VisScatter
      :x="(_d: ChartDataRow, i: number) => i"
      :y="(d: ChartDataRow) => d.ordersScaled"
      :color="chartConfig.orders.color"
      :size="4"
     />

     <!-- X axis: supplier names -->
     <VisAxis
      type="x"
      :x="(_d: ChartDataRow, i: number) => i"
      :tick-line="false"
      :domain-line="false"
      :grid-line="false"
      :tick-format="
       (d: number) => {
        const row = chartData[d]
        if (!row) return ''
        return row.supplier.length > 14
         ? row.supplier.substring(0, 14) + '...'
         : row.supplier
       }
      "
      :tick-values="chartData.map((_: ChartDataRow, i: number) => i)"
     />

     <!-- Y axis: currency scale -->
     <VisAxis
      type="y"
      :tick-format="formatAxisValue"
      :tick-line="false"
      :domain-line="false"
      :grid-line="true"
     />

     <ChartTooltip />
     <ChartCrosshair
      :template="tooltipTemplate"
      :color="[
       chartConfig.netSpend.color,
       chartConfig.saved.color,
       chartConfig.orders.color,
      ]"
     />
    </VisXYContainer>
    <ChartLegendContent />
   </ChartContainer>
  </CardContent>
 </Card>
</template>

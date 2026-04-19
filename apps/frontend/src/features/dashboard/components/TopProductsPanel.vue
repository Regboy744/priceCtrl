<script setup lang="ts">
import { computed } from 'vue'
import type { TopProductRow } from '@/features/dashboard/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateDisplay } from '@/lib/utils/date'
import { Boxes } from 'lucide-vue-next'

interface Props {
 topByUnits: TopProductRow[]
 topBySpend: TopProductRow[]
 isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
 isLoading: false,
})

const maxRows = 10

type DisplayProductRow = TopProductRow & { isPlaceholder?: boolean }

const padTopProducts = (
 rows: TopProductRow[],
 prefix: string,
): DisplayProductRow[] => {
 const trimmed = rows.slice(0, maxRows)
 const padding = Array.from(
  { length: Math.max(0, maxRows - trimmed.length) },
  (_, index) => ({
   master_product_id: `${prefix}-placeholder-${index + 1}`,
   description: '-',
   article_code: '-',
   unit_size: null,
   quantity: 0,
   spend: 0,
   lastOrderDate: null,
   isPlaceholder: true,
  }),
 )

 return [...trimmed, ...padding]
}

const topByUnitsRows = computed(() => padTopProducts(props.topByUnits, 'units'))
const topBySpendRows = computed(() => padTopProducts(props.topBySpend, 'spend'))

const hasAnyData = computed(() => {
 return props.topByUnits.length > 0 || props.topBySpend.length > 0
})
</script>

<template>
 <Card class="overflow-hidden bg-gradient-to-br from-card via-card to-muted/20">
  <CardHeader
   class="flex flex-row items-center justify-between space-y-0 border-b border-border/50 pb-4"
  >
   <div>
    <CardTitle class="text-lg">Most Bought Products</CardTitle>
    <p class="text-sm text-muted-foreground">Top items in selected period</p>
   </div>
   <div
    class="h-9 w-9 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-center"
   >
    <Boxes class="h-4 w-4 text-muted-foreground" />
   </div>
  </CardHeader>
  <CardContent>
   <div v-if="isLoading" class="space-y-3">
    <Skeleton class="h-9 w-40" />
    <Skeleton class="h-56 w-full" />
   </div>

   <div v-else class="space-y-4">
    <p v-if="!hasAnyData" class="text-sm text-muted-foreground text-center">
     No purchases in this period.
    </p>

    <Tabs default-value="units" class="space-y-4">
     <TabsList
      class="grid w-full grid-cols-2 lg:w-auto lg:inline-grid bg-muted/20 border border-border/50 rounded-xl p-1 h-auto"
     >
      <TabsTrigger
       value="units"
       class="data-[state=active]:bg-card data-[state=active]:shadow-sm"
      >
       By Units
      </TabsTrigger>
      <TabsTrigger
       value="spend"
       class="data-[state=active]:bg-card data-[state=active]:shadow-sm"
      >
       By Spend
      </TabsTrigger>
     </TabsList>

     <TabsContent value="units">
      <div class="rounded-lg border border-border/60 overflow-hidden">
       <Table>
        <TableHeader class="bg-muted/20">
         <TableRow>
          <TableHead
           class="text-[11px] uppercase tracking-wider text-muted-foreground"
           >Product</TableHead
          >
          <TableHead
           class="text-[11px] uppercase tracking-wider text-muted-foreground text-right"
           >Units</TableHead
          >
          <TableHead
           class="text-[11px] uppercase tracking-wider text-muted-foreground text-right"
           >Spend</TableHead
          >
          <TableHead
           class="text-[11px] uppercase tracking-wider text-muted-foreground text-right"
           >Last</TableHead
          >
         </TableRow>
        </TableHeader>
        <TableBody>
         <TableRow
          v-for="p in topByUnitsRows"
          :key="p.master_product_id"
          :class="
           p.isPlaceholder ? 'text-muted-foreground/70' : 'hover:bg-muted/20'
          "
         >
          <TableCell class="max-w-[420px]">
           <div class="font-medium truncate">
            {{ p.isPlaceholder ? '-' : p.description }}
           </div>
           <div class="text-xs text-muted-foreground font-mono">
            {{ p.isPlaceholder ? '-' : p.article_code }}
            <span v-if="!p.isPlaceholder && p.unit_size"
             >· {{ p.unit_size }}</span
            >
           </div>
          </TableCell>
          <TableCell class="text-right font-medium">
           {{ p.isPlaceholder ? '-' : p.quantity }}
          </TableCell>
          <TableCell class="text-right">
           {{ p.isPlaceholder ? '-' : formatCurrency(p.spend) }}
          </TableCell>
          <TableCell class="text-right text-muted-foreground">
           {{
            p.isPlaceholder ? '-' : formatDateDisplay(p.lastOrderDate) || '-'
           }}
          </TableCell>
         </TableRow>
        </TableBody>
       </Table>
      </div>
     </TabsContent>

     <TabsContent value="spend">
      <div class="rounded-lg border border-border/60 overflow-hidden">
       <Table>
        <TableHeader class="bg-muted/20">
         <TableRow>
          <TableHead
           class="text-[11px] uppercase tracking-wider text-muted-foreground"
           >Product</TableHead
          >
          <TableHead
           class="text-[11px] uppercase tracking-wider text-muted-foreground text-right"
           >Spend</TableHead
          >
          <TableHead
           class="text-[11px] uppercase tracking-wider text-muted-foreground text-right"
           >Units</TableHead
          >
          <TableHead
           class="text-[11px] uppercase tracking-wider text-muted-foreground text-right"
           >Last</TableHead
          >
         </TableRow>
        </TableHeader>
        <TableBody>
         <TableRow
          v-for="p in topBySpendRows"
          :key="p.master_product_id"
          :class="
           p.isPlaceholder ? 'text-muted-foreground/70' : 'hover:bg-muted/20'
          "
         >
          <TableCell class="max-w-[420px]">
           <div class="font-medium truncate">
            {{ p.isPlaceholder ? '-' : p.description }}
           </div>
           <div class="text-xs text-muted-foreground font-mono">
            {{ p.isPlaceholder ? '-' : p.article_code }}
            <span v-if="!p.isPlaceholder && p.unit_size"
             >· {{ p.unit_size }}</span
            >
           </div>
          </TableCell>
          <TableCell class="text-right font-medium">
           {{ p.isPlaceholder ? '-' : formatCurrency(p.spend) }}
          </TableCell>
          <TableCell class="text-right">
           {{ p.isPlaceholder ? '-' : p.quantity }}
          </TableCell>
          <TableCell class="text-right text-muted-foreground">
           {{
            p.isPlaceholder ? '-' : formatDateDisplay(p.lastOrderDate) || '-'
           }}
          </TableCell>
         </TableRow>
        </TableBody>
       </Table>
      </div>
     </TabsContent>
    </Tabs>
   </div>
  </CardContent>
 </Card>
</template>

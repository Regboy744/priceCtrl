<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle } from 'lucide-vue-next'
</script>

<template>
 <div class="space-y-1.5 text-[11px] text-muted-foreground">
  <div class="flex items-center gap-1.5">
   <div class="w-2.5 h-2.5 rounded bg-success/20 border border-success/40" />
   <span>Best supplier price</span>
  </div>
  <div class="flex items-center gap-1.5">
   <Badge
    variant="outline"
    class="text-[9px] px-1 py-0 border-success text-success"
   >
    Best
   </Badge>
   <span>Order has best price</span>
  </div>
  <div class="flex items-center gap-1.5">
   <span class="text-success font-medium">-€X</span>
   <span>Cheaper than order</span>
  </div>
  <div class="flex items-center gap-1.5">
   <span class="text-destructive font-medium">+€X</span>
   <span>More expensive than order</span>
  </div>
  <div class="flex items-center gap-1.5">
   <Badge variant="secondary" class="text-[9px] px-1 py-0 h-3.5">
    Special
   </Badge>
   <span>Negotiated rate</span>
  </div>
  <div class="flex items-center gap-1.5">
   <Badge variant="outline" class="text-[9px] px-1 py-0 border-dashed">
    +N more
   </Badge>
   <span>Multiple pack sizes</span>
  </div>
  <div class="flex items-center gap-1.5">
   <CheckCircle2 class="h-3.5 w-3.5 text-success" />
   <span>Threshold met</span>
  </div>
  <div class="flex items-center gap-1.5">
   <XCircle class="h-3.5 w-3.5 text-destructive" />
   <span>Below threshold</span>
  </div>
  <div class="flex items-center gap-1.5">
   <span class="text-warning font-medium">-€X</span>
   <span>Cheaper but below threshold</span>
  </div>
 </div>
</template>

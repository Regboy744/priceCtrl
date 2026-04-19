<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, X, Sparkles } from 'lucide-vue-next'
import { usePermissions } from '@/composables/auth/usePermissions'
import { useOrderSubmission } from '../composables/useOrderSubmission'

const { canSee } = usePermissions()

const {
 hasSelections,
 totalSelectedItems,
 totalEstimatedSavings,
 selectedSupplierCount,
 clearSelections,
 openSubmitDialog,
} = useOrderSubmission()

// Format currency
const formatCurrency = (amount: number): string => {
 return new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
 }).format(amount)
}
</script>

<template>
 <Transition
  enter-active-class="transition-all duration-300 ease-out"
  enter-from-class="translate-y-full opacity-0"
  enter-to-class="translate-y-0 opacity-100"
  leave-active-class="transition-all duration-200 ease-in"
  leave-from-class="translate-y-0 opacity-100"
  leave-to-class="translate-y-full opacity-0"
 >
  <div
   v-if="hasSelections"
   class="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg"
  >
   <div class="container mx-auto px-4 py-3">
    <div class="flex items-center justify-between gap-4">
     <!-- Left: Selection summary -->
     <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
       <ShoppingCart class="h-5 w-5 text-primary" />
       <span class="font-medium">
        {{ totalSelectedItems }}
        {{ totalSelectedItems === 1 ? 'item' : 'items' }} selected
       </span>
      </div>

      <Badge variant="secondary" class="text-xs">
       {{ selectedSupplierCount }}
       {{ selectedSupplierCount === 1 ? 'supplier' : 'suppliers' }}
      </Badge>

      <div
       v-if="totalEstimatedSavings > 0"
       class="flex items-center gap-1.5 text-success"
      >
       <Sparkles class="h-4 w-4" />
       <span class="font-semibold">
        Save {{ formatCurrency(totalEstimatedSavings) }}
       </span>
      </div>
     </div>

     <!-- Right: Actions -->
     <div class="flex items-center gap-2">
      <Button variant="ghost" size="sm" @click="clearSelections">
       <X class="mr-1.5 h-4 w-4" />
       Clear
      </Button>
      <Button
       v-if="canSee('orders:send')"
       size="sm"
       @click="openSubmitDialog"
      >
       <ShoppingCart class="mr-1.5 h-4 w-4" />
       Review Order
      </Button>
     </div>
    </div>
   </div>
  </div>
 </Transition>
</template>

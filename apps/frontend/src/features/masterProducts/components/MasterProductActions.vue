<script setup lang="ts">
import MasterProductEditForm from '@/features/masterProducts/components/MasterProductEditForm.vue'
import type {
 MasterProductWithBrand,
 MasterProductFormData,
 BrandOption,
} from '@/features/masterProducts/types'
import SharedSheet from '@/components/shared/SharedSheet.vue'
import { Edit, Trash, RotateCcw, History } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
 Tooltip,
 TooltipContent,
 TooltipProvider,
 TooltipTrigger,
} from '@/components/ui/tooltip'
import { computed } from 'vue'

interface Props {
 product: MasterProductWithBrand
 brands: BrandOption[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
 save: [data: MasterProductFormData]
 delete: [id: string]
 reactivate: [id: string]
}>()

const handleDelete = () => {
 const confirmed = confirm(`Deactivate product "${props.product.description}"?`)
 if (confirmed) {
  emit('delete', props.product.id)
 }
}

const handleReactivate = () => {
 emit('reactivate', props.product.id)
}

// Check if product has EAN history
const hasEanHistory = computed(() => {
 const history = props.product.ean_history as string[] | null
 return history && history.length > 0
})

const eanHistoryCount = computed(() => {
 const history = props.product.ean_history as string[] | null
 return history?.length || 0
})
</script>

<template>
 <div class="flex justify-center items-center gap-2">
  <!-- EAN History indicator -->
  <TooltipProvider v-if="hasEanHistory">
   <Tooltip>
    <TooltipTrigger as-child>
     <Button variant="ghost" class="w-8 h-8 p-0">
      <History class="w-4 h-4 text-blue-400" />
     </Button>
    </TooltipTrigger>
    <TooltipContent>
     <p>{{ eanHistoryCount }} previous EAN code(s)</p>
     <p class="text-xs text-muted-foreground mt-1">
      {{ (product.ean_history as string[])?.join(', ') }}
     </p>
    </TooltipContent>
   </Tooltip>
  </TooltipProvider>

  <!-- Edit button opens sheet -->
  <SharedSheet title="Edit Product" description="Edit product details">
   <template #trigger>
    <Button variant="ghost" class="w-8 h-8 p-0">
     <Edit class="w-4 h-4 text-green-400" />
    </Button>
   </template>
   <template #content="{ close }">
    <MasterProductEditForm
     :product="product"
     :brands="brands"
     @save="
      (data) => {
       emit('save', data)
       close()
      }
     "
    />
   </template>
  </SharedSheet>

  <!-- Reactivate button (only for inactive products) -->
  <TooltipProvider v-if="!product.is_active">
   <Tooltip>
    <TooltipTrigger as-child>
     <Button variant="ghost" class="w-8 h-8 p-0" @click="handleReactivate">
      <RotateCcw class="w-4 h-4 text-amber-500" />
     </Button>
    </TooltipTrigger>
    <TooltipContent>
     <p>Reactivate product</p>
    </TooltipContent>
   </Tooltip>
  </TooltipProvider>

  <!-- Delete/Deactivate button (only for active products) -->
  <TooltipProvider v-if="product.is_active">
   <Tooltip>
    <TooltipTrigger as-child>
     <Button variant="ghost" class="w-8 h-8 p-0" @click="handleDelete">
      <Trash class="w-4 h-4 text-red-500" />
     </Button>
    </TooltipTrigger>
    <TooltipContent>
     <p>Deactivate product</p>
    </TooltipContent>
   </Tooltip>
  </TooltipProvider>
 </div>
</template>

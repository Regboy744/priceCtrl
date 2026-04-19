<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
 Collapsible,
 CollapsibleContent,
 CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { AlertTriangle, ChevronDown } from 'lucide-vue-next'

interface Props {
 articleCodes: string[]
 /** Heading shown in the collapsed header. */
 label?: string
 /** Explanatory sub-text under the heading. */
 description?: string
}

const props = withDefaults(defineProps<Props>(), {
 label: 'not found',
 description: 'These article codes are missing from the catalog',
})

const isExpanded = ref(false)

// Show first 8 by default when collapsed
const visibleCodes = computed(() => {
 if (isExpanded.value) {
  return props.articleCodes
 }
 return props.articleCodes.slice(0, 8)
})

const hasMore = computed(() => props.articleCodes.length > 8)
const remainingCount = computed(() => props.articleCodes.length - 8)
</script>

<template>
 <Collapsible v-model:open="isExpanded">
  <div class="border border-warning/30 bg-warning/5 rounded-lg overflow-hidden">
   <!-- Header -->
   <CollapsibleTrigger as-child>
    <button
     class="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-warning/5 transition-colors text-left"
    >
     <div class="flex items-center gap-2 min-w-0">
      <AlertTriangle class="h-4 w-4 text-warning shrink-0" />
      <p class="text-sm text-warning truncate">
       <span class="font-medium">
        {{ articleCodes.length }} {{ label }}
       </span>
       <span class="text-xs text-muted-foreground ml-1">
        · {{ description }}
       </span>
      </p>
     </div>
     <ChevronDown
      class="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200"
      :class="{ 'rotate-180': isExpanded }"
     />
    </button>
   </CollapsibleTrigger>

   <!-- Content -->
   <CollapsibleContent>
    <div class="px-3 pb-3 pt-0">
     <div class="flex flex-wrap gap-1.5">
      <span
       v-for="code in visibleCodes"
       :key="code"
       class="inline-flex items-center px-2 py-0.5 rounded bg-warning/10 border border-warning/20 text-xs font-mono text-warning"
      >
       {{ code }}
      </span>
     </div>

     <!-- Show more button -->
     <Button
      v-if="hasMore && !isExpanded"
      variant="ghost"
      size="sm"
      class="mt-2 h-7 text-xs text-warning hover:text-warning hover:bg-warning/10 px-2"
      @click.stop="isExpanded = true"
     >
      Show {{ remainingCount }} more
     </Button>
    </div>
   </CollapsibleContent>
  </div>
 </Collapsible>
</template>

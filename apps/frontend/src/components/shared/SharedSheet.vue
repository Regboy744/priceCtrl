<script setup lang="ts">
import {
 Sheet,
 SheetContent,
 SheetHeader,
 SheetTitle,
 SheetTrigger,
 SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '../ui/button'
import { computed } from 'vue'
import { Plus } from 'lucide-vue-next'
// Props for customization
interface Props {
 triggerLabel?: string
 triggerIcon?: boolean
 title?: string
 description?: string
}
withDefaults(defineProps<Props>(), {
 triggerLabel: 'New',
 triggerIcon: true,
 title: 'Add Item',
 description: '',
})

// Use v-model:open if provided, otherwise use internal state
const internalOpen = defineModel<boolean>('open', { default: false })

const isOpen = computed({
 get: () => internalOpen.value,
 set: (value: boolean) => {
  internalOpen.value = value
 },
})

const close = () => {
 isOpen.value = false
}
</script>
<template>
 <Sheet v-model:open="isOpen">
  <!-- TRIGGER: Parent can override or use default button -->
  <SheetTrigger as-child>
   <slot name="trigger">
    <Button>
     <Plus v-if="triggerIcon" class="w-4 h-4 mr-2" />
     {{ triggerLabel }}
    </Button>
   </slot>
  </SheetTrigger>
  <SheetContent class="overflow-y-auto">
   <SheetHeader>
    <!-- TITLE: Customizable via prop, can be overridden with slot -->
    <SheetTitle>
     <slot name="title">{{ title }}</slot>
    </SheetTitle>

    <!-- DESCRIPTION: Optional -->
    <SheetDescription v-if="description">
     <slot name="description">{{ description }}</slot>
    </SheetDescription>
   </SheetHeader>
   <!-- MAIN CONTENT: ANY component goes here -->
   <slot name="content" :close="close" />
   <!-- FOOTER: Optional actions at bottom -->
   <slot name="footer" :close="close" />
  </SheetContent>
 </Sheet>
</template>

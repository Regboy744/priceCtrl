<script lang="ts" setup>
import type { ToasterProps } from 'vue-sonner'
import { computed } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import {
 CircleCheckIcon,
 InfoIcon,
 Loader2Icon,
 OctagonXIcon,
 TriangleAlertIcon,
 XIcon,
} from 'lucide-vue-next'
import { Toaster as Sonner } from 'vue-sonner'
import { cn } from '@/lib/utils/cn'

const props = defineProps<ToasterProps>()

// Merge default toast classes with any passed-in options
const toastOptions = computed(() => ({
 ...props.toastOptions,
 classes: {
  toast:
   'group toast bg-background text-foreground border-border shadow-lg rounded-md border p-4',
  title: 'text-foreground font-semibold',
  description: 'text-muted-foreground',
  success: 'bg-background text-foreground border-border',
  error: 'bg-destructive text-destructive-foreground border-destructive',
  info: 'bg-background text-foreground border-border',
  warning: 'bg-background text-foreground border-border',
  ...props.toastOptions?.classes,
 },
}))

// Extract props without toastOptions and class to avoid duplicate binding
const restProps = reactiveOmit(props, 'toastOptions', 'class')
</script>

<template>
 <Sonner
  :class="cn('toaster group z-[100]', props.class)"
  :toast-options="toastOptions"
  v-bind="restProps"
 >
  <template #success-icon>
   <CircleCheckIcon class="size-4" />
  </template>
  <template #info-icon>
   <InfoIcon class="size-4" />
  </template>
  <template #warning-icon>
   <TriangleAlertIcon class="size-4" />
  </template>
  <template #error-icon>
   <OctagonXIcon class="size-4" />
  </template>
  <template #loading-icon>
   <div>
    <Loader2Icon class="size-4 animate-spin" />
   </div>
  </template>
  <template #close-icon>
   <XIcon class="size-4" />
  </template>
 </Sonner>
</template>

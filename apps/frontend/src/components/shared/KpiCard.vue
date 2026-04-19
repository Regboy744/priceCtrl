<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { cn } from '@/lib/utils/cn'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type KpiTone = 'neutral' | 'success' | 'warning' | 'danger'

interface Props {
 title: string
 value: string | number
 description?: string
 icon?: Component
 valueClass?: string
 loading?: boolean
 tone?: KpiTone
}

const props = withDefaults(defineProps<Props>(), {
 description: undefined,
 icon: undefined,
 valueClass: undefined,
 loading: false,
 tone: 'neutral',
})

const toneStyles = computed(() => {
 switch (props.tone) {
  case 'success':
   return {
    border: 'border-chart-2/25 ring-chart-2/10',
    chip: 'border-chart-2/20 bg-chart-2/12 text-chart-2',
    glow: 'bg-chart-2/25',
    value: 'text-chart-2',
   }
  case 'warning':
   return {
    border: 'border-chart-1/25 ring-chart-1/10',
    chip: 'border-chart-1/20 bg-chart-1/12 text-chart-1',
    glow: 'bg-chart-1/25',
    value: 'text-chart-1',
   }
  case 'danger':
   return {
    border: 'border-destructive/25 ring-destructive/10',
    chip: 'border-destructive/20 bg-destructive/12 text-destructive',
    glow: 'bg-destructive/20',
    value: 'text-destructive',
   }
  default:
   return {
    border: 'border-border/60 ring-ring/10',
    chip: 'border-border/60 bg-muted/30 text-muted-foreground',
    glow: 'bg-ring/10',
    value: 'text-foreground',
   }
 }
})

const finalValueClass = computed(() => {
 return cn(
  'text-3xl leading-none font-semibold tracking-tight',
  props.valueClass || toneStyles.value.value,
 )
})
</script>

<template>
 <Card
  :class="
   cn(
    'relative overflow-hidden bg-gradient-to-br from-card via-card to-muted/20 shadow-sm',
    'ring-1 ring-inset transition-all duration-200',
    'hover:-translate-y-0.5 hover:shadow-md',
    toneStyles.border,
   )
  "
 >
  <div
   aria-hidden="true"
   :class="
    cn(
     'pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl',
     toneStyles.glow,
    )
   "
  />

  <CardHeader class="flex flex-row items-start justify-between space-y-0 pb-2">
   <CardTitle class="text-sm font-medium text-muted-foreground">
    {{ props.title }}
   </CardTitle>
   <div
    v-if="props.icon"
    :class="
     cn(
      'h-9 w-9 rounded-lg border flex items-center justify-center',
      toneStyles.chip,
     )
    "
   >
    <component :is="props.icon" class="h-4 w-4" />
   </div>
  </CardHeader>
  <CardContent>
   <div v-if="props.loading" class="space-y-2">
    <Skeleton class="h-8 w-36" />
    <Skeleton class="h-3 w-48" />
   </div>
   <template v-else>
    <div :class="finalValueClass">{{ props.value }}</div>
    <p v-if="props.description" class="mt-2 text-xs text-muted-foreground/90">
     {{ props.description }}
    </p>
   </template>
  </CardContent>
 </Card>
</template>

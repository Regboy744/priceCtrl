<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { DateRange, DateValue } from 'reka-ui'
import {
 Popover,
 PopoverTrigger,
 PopoverContent,
} from '@/components/ui/popover'
import { RangeCalendar } from '@/components/ui/range-calendar'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarIcon, X } from 'lucide-vue-next'
import { cn } from '@/lib/utils/cn'
import {
 isoToCalendarDate,
 calendarDateToISO,
 formatDateRange,
} from '@/lib/utils/date'

interface Props {
 dateFrom: string | null
 dateTo: string | null
 placeholder?: string
 disabled?: boolean
}

interface Emits {
 (e: 'update:dateFrom', value: string | null): void
 (e: 'update:dateTo', value: string | null): void
 (e: 'clear'): void
}

const props = withDefaults(defineProps<Props>(), {
 placeholder: 'Select date range',
 disabled: false,
})

const emit = defineEmits<Emits>()

// Popover state
const isOpen = ref(false)

// Internal date range state for RangeCalendar
const dateRange = ref<DateRange>({
 start: undefined,
 end: undefined,
})

// Watch external props and sync to internal state
watch(
 () => [props.dateFrom, props.dateTo] as const,
 ([newFrom, newTo]) => {
  dateRange.value = {
   start: (isoToCalendarDate(newFrom ?? null) ?? undefined) as
    | DateValue
    | undefined,
   end: (isoToCalendarDate(newTo ?? null) ?? undefined) as
    | DateValue
    | undefined,
  }
 },
 { immediate: true },
)

// Computed: Check if any dates are selected
const hasSelection = computed(() => props.dateFrom || props.dateTo)

// Computed: Display text for button
const displayText = computed(() => {
 if (!props.dateFrom && !props.dateTo) {
  return ''
 }
 return formatDateRange(props.dateFrom, props.dateTo)
})

// Handler for range change
const handleRangeChange = (range: DateRange) => {
 dateRange.value = range

 const fromIso = range.start ? calendarDateToISO(range.start) : null
 const toIso = range.end ? calendarDateToISO(range.end) : null

 // Only emit if values actually changed
 if (fromIso !== props.dateFrom) {
  emit('update:dateFrom', fromIso)
 }
 if (toIso !== props.dateTo) {
  emit('update:dateTo', toIso)
 }
}

const handleClear = (event: Event) => {
 event.stopPropagation()
 dateRange.value = { start: undefined, end: undefined }
 emit('clear')
}
</script>

<template>
 <Popover v-model:open="isOpen">
  <!-- Trigger Button -->
  <PopoverTrigger as-child>
   <Button
    variant="outline"
    :disabled="disabled"
    :class="
     cn(
      'w-full justify-start text-left font-normal h-9',
      !hasSelection && 'text-muted-foreground',
     )
    "
   >
    <CalendarIcon class="mr-2 h-4 w-4 shrink-0" />
    <span class="truncate">
     {{ displayText || placeholder }}
    </span>

    <!-- Clear button (X icon) -->
    <X
     v-if="hasSelection"
     class="ml-auto h-4 w-4 shrink-0 opacity-50 hover:opacity-100 cursor-pointer"
     @click="handleClear"
    />
   </Button>
  </PopoverTrigger>

  <!-- Popover Content - opens to the right side for better visibility -->
  <PopoverContent
   class="w-auto p-0 bg-gradient-to-br from-background via-background to-muted/30 backdrop-blur-sm shadow-xl"
   side="right"
   align="start"
   :side-offset="8"
   :collision-padding="16"
   :avoid-collisions="true"
  >
   <div class="p-4">
    <!-- Header -->
    <div
     class="flex items-center justify-between mb-4 pb-3 border-b border-border/50"
    >
     <div class="flex items-center gap-2">
      <CalendarIcon class="h-4 w-4 text-primary" />
      <span class="text-sm font-medium">Select Date Range</span>
     </div>
     <Button
      v-if="hasSelection"
      variant="ghost"
      size="sm"
      class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
      @click="handleClear"
     >
      <X class="h-3 w-3 mr-1" />
      Clear
     </Button>
    </div>

    <!-- Calendar -->
    <RangeCalendar
     :model-value="dateRange as any"
     :number-of-months="2"
     class="rounded-lg"
     @update:model-value="handleRangeChange"
    />

    <!-- Footer with selected range display -->
    <div
     v-if="hasSelection"
     class="mt-4 pt-3 border-t border-border/50 flex items-center justify-center"
    >
     <span class="text-sm text-muted-foreground">
      {{ displayText }}
     </span>
    </div>
   </div>
  </PopoverContent>
 </Popover>
</template>

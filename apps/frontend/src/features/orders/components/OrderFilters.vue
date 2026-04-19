<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import {
 Select,
 SelectContent,
 SelectGroup,
 SelectLabel,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FieldError } from '@/components/ui/field'
import { DateRangePicker } from '@/components/ui/date-picker'
import { X, Filter, Building2, Calendar } from 'lucide-vue-next'
import type { OrderFilters, LocationOption } from '@/features/orders/types'

interface Props {
 filters: OrderFilters
 locations: LocationOption[]
 locationsByCompany?: Map<string, LocationOption[]>
 isLoadingLocations?: boolean
 isLocationLocked?: boolean
 allowAllLocations?: boolean
}

interface Emits {
 (e: 'update:filters', filters: Partial<OrderFilters>): void
 (e: 'applyPreset', preset: string): void
 (e: 'reset'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Date validation state
const dateError = ref<string | null>(null)

// Date preset options
const datePresets = [
 { value: 'today', label: 'Today' },
 { value: 'week', label: 'This Week' },
 { value: 'month', label: 'This Month' },
 { value: 'lastMonth', label: 'Last Month' },
 { value: 'custom', label: 'Custom Range' },
]

// Date validation
const validateDateRange = (
 from: string | null,
 to: string | null,
): string | null => {
 // Both dates required for custom range
 if ((from && !to) || (!from && to)) {
  return 'Both From and To dates are required'
 }

 // Check if From is after To
 if (from && to) {
  const fromDate = new Date(from)
  const toDate = new Date(to)

  if (fromDate > toDate) {
   return 'From date cannot be after To date'
  }
 }

 return null // Valid
}

// Computed
const isLocationDisabled = computed(
 () => !!props.isLocationLocked || !!props.isLoadingLocations,
)
const isCustomDateRange = computed(() => props.filters.datePreset === 'custom')

const selectedLocation = computed(
 () =>
  props.locations.find(
   (location) => location.id === props.filters.locationId,
  ) || null,
)

const selectedCompanyName = computed(
 () => selectedLocation.value?.company_name || null,
)

const showGroupedLocations = computed(
 () => props.locationsByCompany && props.locationsByCompany.size > 0,
)

// Check if any filters are active
const hasActiveFilters = computed(() => {
 return (
  props.filters.locationId !== null ||
  props.filters.dateFrom !== null ||
  props.filters.dateTo !== null
 )
})

// Handlers
const handleLocationChange = (value: unknown) => {
 const locationId = value && String(value) !== 'all' ? String(value) : null
 emit('update:filters', { locationId })
}

const handleDatePresetChange = (value: unknown) => {
 if (!value) return // Don't process empty values
 const preset = String(value)
 emit('applyPreset', preset)
}

// Internal update functions (not debounced)
const updateDateFrom = (value: string | null) => {
 const dateFrom = value || null
 const dateTo = props.filters.dateTo

 // Validate date range
 dateError.value = validateDateRange(dateFrom, dateTo)

 // Update filters even if invalid (to show the values)
 emit('update:filters', {
  dateFrom,
  datePreset: 'custom',
 })
}

const updateDateTo = (value: string | null) => {
 const dateFrom = props.filters.dateFrom
 const dateTo = value || null

 // Validate date range
 dateError.value = validateDateRange(dateFrom, dateTo)

 // Update filters even if invalid (to show the values)
 emit('update:filters', {
  dateTo,
  datePreset: 'custom',
 })
}

// Debounced handlers (300ms delay)
const handleDateFromChange = useDebounceFn(updateDateFrom, 300)
const handleDateToChange = useDebounceFn(updateDateTo, 300)

// Clear dates handler (stays in custom mode)
const handleClearDates = () => {
 dateError.value = null
 emit('update:filters', {
  dateFrom: null,
  dateTo: null,
  datePreset: 'custom', // Stay in custom mode
 })
}

const handleReset = () => {
 emit('reset')
}
</script>

<template>
 <div class="space-y-6">
  <!-- Filter Header -->
  <div class="flex items-center justify-between">
   <div class="flex items-center gap-2">
    <Filter class="h-4 w-4 text-primary" />
    <h3 class="text-sm font-semibold tracking-tight">Filters</h3>
   </div>
   <Badge
    v-if="hasActiveFilters"
    variant="secondary"
    class="text-xs px-2 py-0.5"
   >
    Active
   </Badge>
  </div>

  <!-- Location Group -->
  <div class="space-y-3">
   <div
    class="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider"
   >
    <Building2 class="h-3 w-3" />
    <span>Organization</span>
   </div>

   <div class="rounded-lg bg-muted/30 p-4 space-y-4">
    <div class="space-y-1.5">
     <Label for="location-filter" class="text-xs">Location</Label>
     <Select
      :model-value="filters.locationId || 'all'"
      :disabled="isLocationDisabled"
      @update:model-value="handleLocationChange"
     >
      <SelectTrigger id="location-filter" class="h-9 w-full">
       <SelectValue
        :placeholder="
         isLocationDisabled ? 'Loading locations...' : 'Select location'
        "
       />
      </SelectTrigger>
      <SelectContent>
       <SelectGroup v-if="allowAllLocations">
        <SelectItem value="all">All Locations</SelectItem>
       </SelectGroup>
       <template v-if="showGroupedLocations">
        <SelectGroup
         v-for="[companyName, companyLocations] in locationsByCompany"
         :key="companyName"
        >
         <SelectLabel class="flex items-center gap-2">
          <Building2 class="h-3 w-3" />
          {{ companyName }}
         </SelectLabel>
         <SelectItem
          v-for="location in companyLocations"
          :key="location.id"
          :value="location.id"
         >
          {{ location.location_number }} - {{ location.name }}
         </SelectItem>
        </SelectGroup>
       </template>
       <SelectGroup v-else>
        <SelectItem
         v-for="location in locations"
         :key="location.id"
         :value="location.id"
        >
         {{ location.location_number }} - {{ location.name }}
        </SelectItem>
       </SelectGroup>
      </SelectContent>
     </Select>
     <p v-if="selectedLocation" class="text-xs text-muted-foreground">
      Company:
      <span class="font-medium">{{ selectedCompanyName }}</span> · Location:
      <span class="font-medium">
       {{ selectedLocation.name }} (#{{ selectedLocation.location_number }})
      </span>
     </p>
     <p v-else class="text-xs text-muted-foreground">
      Orders are scoped by location.
     </p>
    </div>
   </div>
  </div>

  <!-- Date Range Group -->
  <div class="space-y-3">
   <div
    class="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider"
   >
    <Calendar class="h-3 w-3" />
    <span>Date Range</span>
   </div>

   <div class="rounded-lg bg-muted/30 p-4 space-y-4">
    <!-- Date Preset -->
    <div class="space-y-1.5">
     <Label for="date-preset" class="text-xs">Period</Label>
     <Select
      :model-value="filters.datePreset || undefined"
      @update:model-value="handleDatePresetChange"
     >
      <SelectTrigger id="date-preset" class="h-9 w-full">
       <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent>
       <SelectGroup>
        <SelectItem
         v-for="preset in datePresets"
         :key="preset.value"
         :value="preset.value"
        >
         {{ preset.label }}
        </SelectItem>
       </SelectGroup>
      </SelectContent>
     </Select>
    </div>

    <!-- Date Range Picker (shown when custom is selected) -->
    <div v-if="isCustomDateRange" class="space-y-3">
     <DateRangePicker
      :date-from="filters.dateFrom"
      :date-to="filters.dateTo"
      placeholder="Select date range"
      @update:date-from="handleDateFromChange"
      @update:date-to="handleDateToChange"
      @clear="handleClearDates"
     />

     <!-- Error Message -->
     <FieldError v-if="dateError" :errors="[dateError]" class="text-xs" />
    </div>
   </div>
  </div>

  <!-- Clear All Button -->
  <div v-if="hasActiveFilters">
   <Button
    variant="ghost"
    size="sm"
    class="w-full text-muted-foreground hover:text-foreground"
    @click="handleReset"
   >
    <X class="h-3.5 w-3.5 mr-1.5" />
    Clear All Filters
   </Button>
  </div>
 </div>
</template>

<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { SheetClose } from '@/components/ui/sheet'
import { Loader2 } from 'lucide-vue-next'
import { computed } from 'vue'
import InputValidation from '@/components/appForm/InputValidation.vue'
import {
 Select,
 SelectContent,
 SelectGroup,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select'
import { FieldError } from '@/components/ui/field'
import { locationValidationSchema } from '@/features/locations/schemas/locationSchemas'
import {
 LOCATION_TYPES,
 type Location,
 type LocationType,
 type LocationFormData,
} from '@/features/locations/types'

interface Props {
 location?: Location
}

const props = defineProps<Props>()

const emit = defineEmits<{
 save: [data: LocationFormData]
}>()

const isEditMode = computed(() => !!props.location)

const { defineField, handleSubmit, isSubmitting, errors } = useForm({
 validationSchema: toTypedSchema(locationValidationSchema),
 initialValues: {
  name: props.location?.name ?? '',
  location_number: props.location?.location_number ?? 1,
  location_type: (props.location?.location_type as LocationType) ?? 'store',
  is_active: props.location?.is_active ?? true,
 },
})

const [name, nameAttrs] = defineField('name')
const [locationNumber, locationNumberAttrs] = defineField('location_number')
const [locationType, locationTypeAttrs] = defineField('location_type')
const [isActive, isActiveAttrs] = defineField('is_active')

const onSubmit = handleSubmit((validatedData) => {
 const locationData: LocationFormData = {
  name: validatedData.name,
  location_number: validatedData.location_number,
  location_type: validatedData.location_type,
  is_active: validatedData.is_active,
 }

 if (isEditMode.value && props.location?.id) {
  emit('save', { ...locationData, id: props.location.id })
 } else {
  emit('save', locationData)
 }
})

const submitButtonText = computed(() => {
 if (isSubmitting.value) {
  return isEditMode.value ? 'Saving...' : 'Creating...'
 }
 return isEditMode.value ? 'Save Changes' : 'Create Location'
})

// Format location type for display
const formatLocationType = (type: string) => {
 return type.charAt(0).toUpperCase() + type.slice(1)
}
</script>

<template>
 <form id="form-location" @submit.prevent="onSubmit" class="space-y-6 px-4">
  <!-- Location Information -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     Location Details
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50">
    <InputValidation
     v-model="name"
     v-bind="nameAttrs"
     label="Location Name"
     placeholder="e.g. Dublin Main Store"
     :error="errors.name"
    />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
     <InputValidation
      v-model.number="locationNumber"
      v-bind="locationNumberAttrs"
      label="Location Number"
      type="number"
      placeholder="1"
      :error="errors.location_number"
     />

     <!-- Location Type Select -->
     <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">Location Type</label>
      <Select
       :model-value="locationType"
       v-bind="locationTypeAttrs"
       @update:model-value="
        (value) => value && (locationType = value as LocationType)
       "
      >
       <SelectTrigger
        class="w-full"
        :aria-invalid="!!errors.location_type"
        :class="{
         'border-destructive focus-visible:ring-destructive':
          errors.location_type,
        }"
       >
        <SelectValue placeholder="Select type" />
       </SelectTrigger>
       <SelectContent>
        <SelectGroup>
         <SelectItem v-for="type in LOCATION_TYPES" :key="type" :value="type">
          {{ formatLocationType(type) }}
         </SelectItem>
        </SelectGroup>
       </SelectContent>
      </Select>
      <FieldError
       v-if="errors.location_type"
       :errors="[errors.location_type]"
      />
     </div>
    </div>
   </div>
  </div>

  <!-- Status -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     Status
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div
    class="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50"
   >
    <div class="space-y-0.5">
     <label class="text-sm font-medium leading-none">Location Status</label>
     <p class="text-sm text-muted-foreground">
      {{ isActive ? 'This location is active' : 'This location is inactive' }}
     </p>
    </div>
    <Switch
     v-model="isActive"
     v-bind="isActiveAttrs"
     :aria-label="`Set location status to ${isActive ? 'inactive' : 'active'}`"
    />
   </div>
  </div>

  <!-- Submit Actions -->
  <div
   class="sticky bottom-0 pt-6 pb-6 -mx-4 px-4 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-t"
  >
   <div class="flex flex-col-reverse sm:flex-row sm:justify-center gap-3">
    <SheetClose as-child>
     <Button variant="outline" type="button" class="w-full sm:w-35">
      Cancel
     </Button>
    </SheetClose>
    <Button type="submit" class="w-full sm:w-35" :disabled="isSubmitting">
     <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
     {{ submitButtonText }}
    </Button>
   </div>
  </div>
 </form>
</template>

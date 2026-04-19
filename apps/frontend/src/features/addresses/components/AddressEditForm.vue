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
import { addressValidationSchema } from '@/features/addresses/schemas/addressSchemas'
import {
 ADDRESS_TYPES,
 type Address,
 type AddressType,
 type AddressFormData,
} from '@/features/addresses/types'

interface Props {
 address?: Address | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
 save: [data: AddressFormData]
}>()

const isEditMode = computed(() => !!props.address)

const { defineField, handleSubmit, isSubmitting, errors } = useForm({
 validationSchema: toTypedSchema(addressValidationSchema),
 initialValues: {
  street_address: props.address?.street_address ?? '',
  address_line2: props.address?.address_line2 ?? '',
  city: props.address?.city ?? '',
  county: props.address?.county ?? '',
  eircode: props.address?.eircode ?? '',
  country: props.address?.country ?? 'Ireland',
  address_type: (props.address?.address_type as AddressType) ?? 'headoffice',
  is_active: props.address?.is_active ?? true,
 },
})

const [streetAddress, streetAddressAttrs] = defineField('street_address')
const [addressLine2, addressLine2Attrs] = defineField('address_line2')
const [city, cityAttrs] = defineField('city')
const [county, countyAttrs] = defineField('county')
const [eircode, eircodeAttrs] = defineField('eircode')
const [country, countryAttrs] = defineField('country')
const [addressType, addressTypeAttrs] = defineField('address_type')
const [isActive, isActiveAttrs] = defineField('is_active')

const onSubmit = handleSubmit((validatedData) => {
 const addressData: AddressFormData = {
  street_address: validatedData.street_address,
  address_line2: validatedData.address_line2,
  city: validatedData.city,
  county: validatedData.county,
  eircode: validatedData.eircode,
  country: validatedData.country,
  address_type: validatedData.address_type,
  is_active: validatedData.is_active,
 }

 if (isEditMode.value && props.address?.id) {
  emit('save', { ...addressData, id: props.address.id })
 } else {
  emit('save', addressData)
 }
})

const submitButtonText = computed(() => {
 if (isSubmitting.value) {
  return isEditMode.value ? 'Saving...' : 'Creating...'
 }
 return isEditMode.value ? 'Save Changes' : 'Add Address'
})

// Format address type for display
const formatAddressType = (type: string) => {
 if (type === 'headoffice') return 'Head Office'
 return type.charAt(0).toUpperCase() + type.slice(1)
}
</script>

<template>
 <form id="form-address" @submit.prevent="onSubmit" class="space-y-6 px-4">
  <!-- Address Details -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     Address Details
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50">
    <InputValidation
     v-model="streetAddress"
     v-bind="streetAddressAttrs"
     label="Street Address"
     placeholder="123 Main Street"
     :error="errors.street_address"
    />

    <InputValidation
     v-model="addressLine2"
     v-bind="addressLine2Attrs"
     label="Address Line 2"
     placeholder="Apt 4B, Building C (optional)"
     :error="errors.address_line2"
    />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
     <InputValidation
      v-model="city"
      v-bind="cityAttrs"
      label="City"
      placeholder="Dublin"
      :error="errors.city"
     />
     <InputValidation
      v-model="county"
      v-bind="countyAttrs"
      label="County"
      placeholder="County Dublin"
      :error="errors.county"
     />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
     <InputValidation
      v-model="eircode"
      v-bind="eircodeAttrs"
      label="Eircode"
      placeholder="D02 XY45"
      :error="errors.eircode"
     />
     <InputValidation
      v-model="country"
      v-bind="countryAttrs"
      label="Country"
      placeholder="Ireland"
      :error="errors.country"
     />
    </div>

    <!-- Address Type Select -->
    <div class="flex flex-col gap-2">
     <label class="text-sm font-medium">Address Type</label>
     <Select
      :model-value="addressType"
      v-bind="addressTypeAttrs"
      @update:model-value="
       (value) => value && (addressType = value as AddressType)
      "
     >
      <SelectTrigger
       class="w-full"
       :aria-invalid="!!errors.address_type"
       :class="{
        'border-destructive focus-visible:ring-destructive':
         errors.address_type,
       }"
      >
       <SelectValue placeholder="Select type" />
      </SelectTrigger>
      <SelectContent>
       <SelectGroup>
        <SelectItem v-for="type in ADDRESS_TYPES" :key="type" :value="type">
         {{ formatAddressType(type) }}
        </SelectItem>
       </SelectGroup>
      </SelectContent>
     </Select>
     <FieldError v-if="errors.address_type" :errors="[errors.address_type]" />
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
     <label class="text-sm font-medium leading-none">Address Status</label>
     <p class="text-sm text-muted-foreground">
      {{ isActive ? 'This address is active' : 'This address is inactive' }}
     </p>
    </div>
    <Switch
     v-model="isActive"
     v-bind="isActiveAttrs"
     :aria-label="`Set address status to ${isActive ? 'inactive' : 'active'}`"
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

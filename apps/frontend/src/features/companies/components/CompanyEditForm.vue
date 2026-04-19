<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { Switch } from '@/components/ui/switch'
import InputValidation from '@/components/appForm/InputValidation.vue'
import { companyValidationSchema } from '@/features/companies/schemas/companySchemas'
import { computed, onMounted, ref } from 'vue'
import {
 Select,
 SelectContent,
 SelectGroup,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select'
import { FieldError } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { SheetClose } from '@/components/ui/sheet'
import { Loader2 } from 'lucide-vue-next'
import type {
 CompanyWithBrand,
 CompanyFormData,
} from '@/features/companies/types'
import { brandsQuery, type BrandsType } from '@/features/companies/api/queries'

interface Props {
 company?: CompanyWithBrand | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
 save: [data: CompanyFormData]
}>()

const isEditMode = computed(() => !!props.company)
const brands = ref<BrandsType>([])

// Fetch brands for dropdown
onMounted(async () => {
 const { data } = await brandsQuery()
 if (data) {
  brands.value = data
 }
})

const { defineField, handleSubmit, isSubmitting, errors } = useForm({
 validationSchema: toTypedSchema(companyValidationSchema),
 initialValues: {
  name: props.company?.name ?? '',
  brand_id: props.company?.brand_id ?? null,
  phone: props.company?.phone ?? '',
  email: props.company?.email ?? '',
  is_active: props.company?.is_active ?? true,
 },
})

const [name, nameAttrs] = defineField('name')
const [brandId, brandIdAttrs] = defineField('brand_id')
const [phone, phoneAttrs] = defineField('phone')
const [email, emailAttrs] = defineField('email')
const [isActive, isActiveAttrs] = defineField('is_active')

const onSubmit = handleSubmit((validatedData) => {
 const companyData: CompanyFormData = {
  name: validatedData.name,
  brand_id: validatedData.brand_id,
  phone: validatedData.phone,
  email: validatedData.email,
  is_active: validatedData.is_active,
 }

 if (isEditMode.value && props.company?.id) {
  emit('save', { ...companyData, id: props.company.id })
 } else {
  emit('save', companyData)
 }
})

const submitButtonText = computed(() => {
 if (isSubmitting.value) {
  return isEditMode.value ? 'Saving...' : 'Creating...'
 }
 return isEditMode.value ? 'Save Changes' : 'Create Company'
})
</script>

<template>
 <form id="form-vee-company" @submit.prevent="onSubmit" class="space-y-6 px-4">
  <!-- Company Information -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     Company
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50">
    <InputValidation
     v-model="name"
     v-bind="nameAttrs"
     label="Company Name"
     placeholder="Enter company name"
     :error="errors.name"
    />

    <!-- Brand Select -->
    <div class="flex flex-col gap-2">
     <label class="text-sm font-medium">Brand</label>
     <Select
      :model-value="brandId ?? undefined"
      v-bind="brandIdAttrs"
      @update:model-value="(value) => (brandId = value ? String(value) : null)"
     >
      <SelectTrigger
       class="w-full"
       :aria-invalid="!!errors.brand_id"
       :class="{
        'border-destructive focus-visible:ring-destructive': errors.brand_id,
       }"
      >
       <SelectValue placeholder="Select brand" />
      </SelectTrigger>
      <SelectContent>
       <SelectGroup>
        <SelectItem v-for="brand in brands" :key="brand.id" :value="brand.id">
         {{ brand.name }}
        </SelectItem>
       </SelectGroup>
      </SelectContent>
     </Select>
     <FieldError v-if="errors.brand_id" :errors="[errors.brand_id]" />
    </div>
   </div>
  </div>

  <!-- Contact Information -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     Contact
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50">
    <InputValidation
     v-model="phone"
     v-bind="phoneAttrs"
     label="Phone"
     placeholder="+353 1 234 5678"
     :error="errors.phone"
    />
    <InputValidation
     v-model="email"
     v-bind="emailAttrs"
     label="Email"
     type="email"
     placeholder="company@example.ie"
     :error="errors.email"
    />
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
     <label class="text-sm font-medium leading-none">Company Status</label>
     <p class="text-sm text-muted-foreground">
      {{ isActive ? 'This company is active' : 'This company is inactive' }}
     </p>
    </div>
    <Switch
     v-model="isActive"
     v-bind="isActiveAttrs"
     :aria-label="`Set company status to ${isActive ? 'inactive' : 'active'}`"
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

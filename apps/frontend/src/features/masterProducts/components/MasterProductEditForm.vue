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
import { masterProductValidationSchema } from '@/features/masterProducts/schemas/masterProductSchemas'
import {
 ACCOUNT_TYPES,
 type MasterProductWithBrand,
 type MasterProductFormData,
 type BrandOption,
 type AccountType,
} from '@/features/masterProducts/types'

interface Props {
 product?: MasterProductWithBrand | null
 brands: BrandOption[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
 save: [data: MasterProductFormData]
}>()

const isEditMode = computed(() => !!props.product)

const { defineField, handleSubmit, isSubmitting, errors } = useForm({
 validationSchema: toTypedSchema(masterProductValidationSchema),
 initialValues: {
  brand_id: props.product?.brand_id ?? '',
  article_code: props.product?.article_code ?? '',
  ean_code: props.product?.ean_code ?? '',
  description: props.product?.description ?? '',
  account: (props.product?.account as AccountType) ?? null,
  unit_size: props.product?.unit_size ?? '',
  is_active: props.product?.is_active ?? true,
 },
})

const [brandId, brandIdAttrs] = defineField('brand_id')
const [articleCode, articleCodeAttrs] = defineField('article_code')
const [eanCode, eanCodeAttrs] = defineField('ean_code')
const [description, descriptionAttrs] = defineField('description')
const [account, accountAttrs] = defineField('account')
const [unitSize, unitSizeAttrs] = defineField('unit_size')
const [isActive, isActiveAttrs] = defineField('is_active')

const onSubmit = handleSubmit((validatedData) => {
 const productData: MasterProductFormData = {
  brand_id: validatedData.brand_id,
  article_code: validatedData.article_code,
  ean_code: validatedData.ean_code,
  description: validatedData.description,
  account: validatedData.account,
  unit_size: validatedData.unit_size || null,
  is_active: validatedData.is_active,
 }

 if (isEditMode.value && props.product?.id) {
  emit('save', { ...productData, id: props.product.id })
 } else {
  emit('save', productData)
 }
})

const submitButtonText = computed(() => {
 if (isSubmitting.value) {
  return isEditMode.value ? 'Saving...' : 'Creating...'
 }
 return isEditMode.value ? 'Save Changes' : 'Create Product'
})

// Format account type for display
const formatAccountType = (type: string) => {
 return type
  .split('_')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  .join(' ')
}
</script>

<template>
 <form
  id="form-master-product"
  @submit.prevent="onSubmit"
  class="space-y-6 px-4"
 >
  <!-- Brand Selection -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     Brand
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50">
    <div class="flex flex-col gap-2">
     <label class="text-sm font-medium">Brand</label>
     <Select
      :model-value="brandId"
      v-bind="brandIdAttrs"
      :disabled="isEditMode"
      @update:model-value="(value) => value && (brandId = String(value))"
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
        <SelectItem
         v-for="brand in props.brands"
         :key="brand.id"
         :value="brand.id"
        >
         {{ brand.name }}
        </SelectItem>
       </SelectGroup>
      </SelectContent>
     </Select>
     <FieldError v-if="errors.brand_id" :errors="[errors.brand_id]" />
     <p v-if="isEditMode" class="text-xs text-muted-foreground">
      Brand cannot be changed after creation
     </p>
    </div>
   </div>
  </div>

  <!-- Product Codes -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     Product Codes
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
     <InputValidation
      v-model="articleCode"
      v-bind="articleCodeAttrs"
      label="Article Code"
      placeholder="e.g. 1234567890"
      :error="errors.article_code"
     />
     <InputValidation
      v-model="eanCode"
      v-bind="eanCodeAttrs"
      label="EAN Code"
      placeholder="e.g. 5901234123457"
      :error="errors.ean_code"
     />
    </div>
   </div>
  </div>

  <!-- Product Details -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     Product Details
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50">
    <InputValidation
     v-model="description"
     v-bind="descriptionAttrs"
     label="Description"
     placeholder="e.g. Fresh Milk 1L"
     :error="errors.description"
    />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
     <!-- Account Type Select -->
     <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">Account (Category)</label>
      <Select
       :model-value="account ?? undefined"
       v-bind="accountAttrs"
       @update:model-value="
        (value) => (account = (value as AccountType) || null)
       "
      >
       <SelectTrigger
        class="w-full"
        :aria-invalid="!!errors.account"
        :class="{
         'border-destructive focus-visible:ring-destructive': errors.account,
        }"
       >
        <SelectValue placeholder="Select account type" />
       </SelectTrigger>
       <SelectContent>
        <SelectGroup>
         <SelectItem v-for="type in ACCOUNT_TYPES" :key="type" :value="type">
          {{ formatAccountType(type) }}
         </SelectItem>
        </SelectGroup>
       </SelectContent>
      </Select>
      <FieldError v-if="errors.account" :errors="[errors.account]" />
     </div>

     <InputValidation
      :model-value="unitSize ?? ''"
      @update:model-value="(v: string | number) => (unitSize = String(v) || '')"
      v-bind="unitSizeAttrs"
      label="Unit Size"
      placeholder="e.g. 1L, 500g, 12 pack"
      :error="errors.unit_size"
     />
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
     <label class="text-sm font-medium leading-none">Product Status</label>
     <p class="text-sm text-muted-foreground">
      {{ isActive ? 'This product is active' : 'This product is inactive' }}
     </p>
    </div>
    <Switch
     v-model="isActive"
     v-bind="isActiveAttrs"
     :aria-label="`Set product status to ${isActive ? 'inactive' : 'active'}`"
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

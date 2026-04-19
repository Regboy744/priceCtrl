<script setup lang="ts">
import {
 Select,
 SelectContent,
 SelectGroup,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select'
import { FieldError } from '@/components/ui/field' // ← Add this
import { useId } from 'vue'

interface Props {
 brands: string[]
 error?: string
 label: string
 placeholder?: string
 disable?: boolean
 modelValue?: string
}

defineProps<Props>()

const emit = defineEmits<{
 'update:modelValue': [value: string]
}>()

const selectId = useId()
const errorId = `${selectId}-error`
</script>

<template>
 <div class="flex flex-col gap-2">
  <label :for="selectId" class="text-sm font-medium">{{ label }}</label>
  <Select
   :model-value="modelValue"
   v-bind="$attrs"
   @update:model-value="
    (value) => value && emit('update:modelValue', value as string)
   "
  >
   <SelectTrigger
    :id="selectId"
    class="w-full"
    :aria-invalid="!!error"
    :aria-describedby="error ? errorId : undefined"
    :class="{
     'border-destructive focus-visible:ring-destructive': error,
    }"
   >
    <SelectValue :placeholder="placeholder" />
   </SelectTrigger>
   <SelectContent>
    <SelectGroup>
     <SelectItem v-for="brand in brands" :key="brand" :value="brand">
      {{ brand }}
     </SelectItem>
    </SelectGroup>
   </SelectContent>
  </Select>
  <!-- ✅ Use Shadcn's FieldError component -->
  <FieldError v-if="error" :id="errorId" :errors="[error]" />
 </div>
</template>

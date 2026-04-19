<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/ui/field' // ← Add this
import { useId } from 'vue'

interface Props {
 modelValue?: string | number
 error?: string
 label: string
 placeholder?: string
 type?: string
 disabled?: boolean
}

withDefaults(defineProps<Props>(), {
 type: 'text',
 disabled: false,
})

const emit = defineEmits<{
 'update:modelValue': [value: string | number]
}>()

const inputId = useId()
const errorId = `${inputId}-error`
</script>

<template>
 <div class="flex flex-col gap-2">
  <label :for="inputId" class="text-sm font-medium">{{ label }}</label>
  <Input
   :id="inputId"
   :model-value="modelValue"
   :type="type"
   :placeholder="placeholder"
   :disabled="disabled"
   :aria-invalid="!!error"
   :aria-describedby="error ? errorId : undefined"
   :class="{
    'border-destructive focus-visible:ring-destructive': error,
   }"
   v-bind="$attrs"
   @update:model-value="emit('update:modelValue', $event)"
  />
  <!-- ✅ Use Shadcn's FieldError component -->
  <FieldError v-if="error" :id="errorId" :errors="[error]" />
 </div>
</template>

<script setup lang="ts">
import CompanyEditForm from '@/features/companies/components/CompanyEditForm.vue'
import type {
 CompanyWithBrand,
 CompanyFormData,
} from '@/features/companies/types'
import SharedSheet from '@/components/shared/SharedSheet.vue'
import { Edit, Trash } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

interface Props {
 company: CompanyWithBrand
}

const props = defineProps<Props>()

const emit = defineEmits<{
 save: [data: CompanyFormData]
 delete: [id: string]
}>()

const handleDelete = async (id: string) => {
 const confirmed = confirm(`Delete ${props.company.name}?`)
 if (confirmed) {
  emit('delete', id)
 }
}
</script>

<template>
 <div class="flex justify-center items-center gap-4">
  <!-- Edit button opens sheet -->
  <SharedSheet title="Edit Company" description="Edit company in the system">
   <template #trigger>
    <Button variant="ghost" class="w-8 h-8 p-0">
     <Edit class="w-4 h-4 text-green-400" />
    </Button>
   </template>
   <template #content="{ close }">
    <CompanyEditForm
     :company="company"
     @save="
      async (data) => {
       emit('save', data)
       close()
      }
     "
    />
   </template>
  </SharedSheet>

  <!-- Delete button -->
  <Button
   variant="ghost"
   class="w-8 h-8 p-0"
   @click="handleDelete(props.company.id)"
  >
   <Trash class="w-4 h-4 text-red-500" />
  </Button>
 </div>
</template>

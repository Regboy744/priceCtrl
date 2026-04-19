<script setup lang="ts">
import LocationEditForm from '@/features/locations/components/LocationEditForm.vue'
import CredentialsList from '@/features/locationCredentials/components/CredentialsList.vue'
import type { Location, LocationFormData } from '@/features/locations/types'
import SharedSheet from '@/components/shared/SharedSheet.vue'
import { Edit, Trash, KeyRound } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

interface Props {
 location: Location
 readOnly?: boolean
 allowCredentials?: boolean
}

const props = withDefaults(defineProps<Props>(), {
 readOnly: false,
 allowCredentials: true,
})

const emit = defineEmits<{
 save: [data: LocationFormData]
 delete: [id: string]
}>()

const handleDelete = () => {
 const confirmed = confirm(`Delete location "${props.location.name}"?`)
 if (confirmed) {
  emit('delete', props.location.id)
 }
}
</script>

<template>
 <div class="flex justify-center items-center gap-2">
  <!-- Credentials button opens sheet -->
  <SharedSheet
   v-if="allowCredentials"
   title="Supplier Credentials"
   :description="`Manage login credentials for ${location.name}`"
  >
   <template #trigger>
    <Button variant="ghost" class="w-8 h-8 p-0">
     <KeyRound class="w-4 h-4 text-amber-500" />
    </Button>
   </template>
   <template #content>
    <CredentialsList
     :location-id="location.id"
     :company-id="location.company_id"
     :location-name="location.name"
    />
   </template>
  </SharedSheet>

  <!-- Edit button opens sheet -->
  <SharedSheet
   v-if="!readOnly"
   title="Edit Location"
   description="Edit location details"
  >
   <template #trigger>
    <Button variant="ghost" class="w-8 h-8 p-0">
     <Edit class="w-4 h-4 text-green-400" />
    </Button>
   </template>
   <template #content="{ close }">
    <LocationEditForm
     :location="location"
     @save="
      (data) => {
       emit('save', data)
       close()
      }
     "
    />
   </template>
  </SharedSheet>

  <!-- Delete button -->
  <Button
   v-if="!readOnly"
   variant="ghost"
   class="w-8 h-8 p-0"
   @click="handleDelete"
  >
   <Trash class="w-4 h-4 text-red-500" />
  </Button>
 </div>
</template>

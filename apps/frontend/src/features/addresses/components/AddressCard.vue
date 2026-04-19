<script setup lang="ts">
import { MapPin, Pencil, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from '@/components/ui/card'
import SharedSheet from '@/components/shared/SharedSheet.vue'
import AddressEditForm from '@/features/addresses/components/AddressEditForm.vue'
import type { Address, AddressFormData } from '@/features/addresses/types'

interface Props {
 address: Address | null
 isLoading?: boolean
 readOnly?: boolean
}

withDefaults(defineProps<Props>(), {
 isLoading: false,
 readOnly: false,
})

const emit = defineEmits<{
 save: [data: AddressFormData]
 delete: []
}>()

// Format address type for display
const formatAddressType = (type: string) => {
 if (type === 'headoffice') return 'Head Office'
 return type.charAt(0).toUpperCase() + type.slice(1)
}
</script>

<template>
 <Card>
  <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
   <div>
    <CardTitle class="text-lg">Address</CardTitle>
    <CardDescription>Company headquarters location</CardDescription>
   </div>
   <div v-if="address && !readOnly" class="flex items-center gap-2">
    <SharedSheet
     trigger-label="Edit"
     :trigger-icon="false"
     title="Edit Address"
     description="Update company address information"
    >
     <template #trigger>
      <Button variant="outline" size="sm">
       <Pencil class="h-4 w-4 mr-2" />
       Edit
      </Button>
     </template>
     <template #content="{ close }">
      <AddressEditForm
       :address="address"
       @save="
        (data) => {
         emit('save', data)
         close()
        }
       "
      />
     </template>
    </SharedSheet>
    <Button variant="outline" size="sm" @click="emit('delete')">
     <Trash2 class="h-4 w-4" />
    </Button>
   </div>
  </CardHeader>
  <CardContent>
   <!-- Loading state -->
   <div v-if="isLoading" class="flex items-center justify-center py-8">
    <div
     class="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full"
    />
   </div>

   <!-- Address exists -->
   <div v-else-if="address" class="flex items-start gap-3">
    <MapPin class="h-4 w-4 text-muted-foreground mt-1" />
    <div class="space-y-1">
     <p class="font-medium">{{ address.street_address }}</p>
     <p v-if="address.address_line2" class="text-sm text-muted-foreground">
      {{ address.address_line2 }}
     </p>
     <p class="text-sm text-muted-foreground">
      {{ address.city }}, {{ address.county }}
     </p>
     <p class="text-sm text-muted-foreground">
      {{ address.eircode }} - {{ address.country }}
     </p>
     <p class="text-xs text-muted-foreground mt-2">
      Type: {{ formatAddressType(address.address_type) }}
     </p>
    </div>
   </div>

   <!-- No address - empty state -->
   <div
    v-else
    class="flex flex-col items-center justify-center py-8 text-center"
   >
    <MapPin class="h-10 w-10 text-muted-foreground mb-3" />
    <p class="text-sm text-muted-foreground mb-4">No address added yet</p>
    <SharedSheet
     v-if="!readOnly"
     trigger-label="Add Address"
     title="Add Address"
     description="Add company address information"
    >
     <template #trigger>
      <Button variant="outline" size="sm">
       <MapPin class="h-4 w-4 mr-2" />
       Add Address
      </Button>
     </template>
     <template #content="{ close }">
      <AddressEditForm
       @save="
        (data) => {
         emit('save', data)
         close()
        }
       "
      />
     </template>
    </SharedSheet>
   </div>
  </CardContent>
 </Card>
</template>

<script setup lang="ts">
import { computed, toRef, ref, onMounted } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
 AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
 KeyRound,
 Check,
 X,
 Clock,
 AlertCircle,
 Pencil,
 Trash2,
 Plus,
 PlugZap,
 Loader2,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useLocationCredentials } from '@/features/locationCredentials/composables/useLocationCredentials'
import type {
 SupplierWithCredential,
 CredentialFormData,
} from '@/features/locationCredentials/types'
import CredentialEditForm from './CredentialEditForm.vue'

interface Props {
 locationId: string
 companyId: string
 locationName: string
}

const props = defineProps<Props>()

const locationIdRef = toRef(props, 'locationId')
const companyIdRef = toRef(props, 'companyId')

const {
 suppliersWithCredentials,
 isLoading,
 loadData,
 saveCredential,
 removeCredential,
 checkCredential,
} = useLocationCredentials(locationIdRef, companyIdRef)

// Track which supplier is being edited
const editingSupplier = ref<SupplierWithCredential | null>(null)
const isFormOpen = ref(false)
const testingId = ref<string | null>(null)

// Load data on mount
onMounted(async () => {
 await loadData()
})

// Status badge config
const getStatusConfig = (status: string | null) => {
 switch (status) {
  case 'success':
   return {
    variant: 'default' as const,
    icon: Check,
    label: 'Active',
   }
  case 'failed':
   return {
    variant: 'destructive' as const,
    icon: X,
    label: 'Failed',
   }
  case 'expired':
   return {
    variant: 'secondary' as const,
    icon: AlertCircle,
    label: 'Expired',
   }
  case 'pending':
   return {
    variant: 'outline' as const,
    icon: Clock,
    label: 'Pending',
   }
  default:
   return {
    variant: 'outline' as const,
    icon: KeyRound,
    label: 'Not Set',
   }
 }
}

// Handle edit click
const handleEdit = (supplier: SupplierWithCredential) => {
 editingSupplier.value = supplier
 isFormOpen.value = true
}

// Handle add click (no existing credential)
const handleAdd = (supplier: SupplierWithCredential) => {
 editingSupplier.value = supplier
 isFormOpen.value = true
}

// Handle save
const handleSave = async (data: CredentialFormData) => {
 const credentialId = editingSupplier.value?.credential_id ?? undefined
 const success = await saveCredential(data, credentialId)
 if (success) {
  isFormOpen.value = false
  editingSupplier.value = null
 }
}

// Handle delete
const handleDelete = async (credentialId: string) => {
 await removeCredential(credentialId)
}

// Handle test
const handleTest = async (supplier: SupplierWithCredential) => {
 if (!supplier.credential_id) return
 testingId.value = supplier.credential_id
 try {
  const result = await checkCredential(supplier.credential_id)
  if (result.ok) {
   toast.success(`${supplier.supplier_name} login OK`)
  } else {
   toast.error(`${supplier.supplier_name} login failed`, {
    description: result.error ?? 'Unknown error',
   })
  }
 } finally {
  testingId.value = null
 }
}

// Handle cancel
const handleCancel = () => {
 isFormOpen.value = false
 editingSupplier.value = null
}

// Suppliers with credentials vs without
const configuredSuppliers = computed(() =>
 suppliersWithCredentials.value.filter((s) => s.credential_id !== null),
)

const unconfiguredSuppliers = computed(() =>
 suppliersWithCredentials.value.filter((s) => s.credential_id === null),
)

const hasAnySuppliers = computed(
 () => suppliersWithCredentials.value.length > 0,
)
</script>

<template>
 <div class="space-y-6 py-4">
  <!-- Form view when editing -->
  <div v-if="isFormOpen && editingSupplier">
   <div class="flex items-center gap-2 mb-4">
    <Button variant="ghost" size="sm" @click="handleCancel">
     <X class="h-4 w-4 mr-1" />
     Back
    </Button>
    <span class="text-sm text-muted-foreground">
     {{ editingSupplier.credential_id ? 'Edit' : 'Add' }} credentials for
     {{ editingSupplier.supplier_name }}
    </span>
   </div>
   <CredentialEditForm
    :supplier="editingSupplier"
    @save="handleSave"
    @cancel="handleCancel"
   />
  </div>

  <!-- List view -->
  <div v-else>
   <!-- Loading state -->
   <div v-if="isLoading" class="space-y-3">
    <Skeleton class="h-16 w-full" />
    <Skeleton class="h-16 w-full" />
    <Skeleton class="h-16 w-full" />
   </div>

   <!-- Empty state - no suppliers -->
   <div
    v-else-if="!hasAnySuppliers"
    class="text-center py-8 text-muted-foreground"
   >
    <KeyRound class="h-12 w-12 mx-auto mb-4 opacity-50" />
    <p>No suppliers available.</p>
    <p class="text-sm">Add suppliers to configure credentials.</p>
   </div>

   <!-- Suppliers list -->
   <div v-else class="space-y-6">
    <!-- Configured credentials -->
    <div v-if="configuredSuppliers.length > 0">
     <h4 class="text-sm font-medium text-muted-foreground mb-3">
      Configured Credentials ({{ configuredSuppliers.length }})
     </h4>
     <div class="space-y-2">
      <Card
       v-for="supplier in configuredSuppliers"
       :key="supplier.supplier_id"
       class="hover:bg-accent/50 transition-colors"
      >
       <CardContent class="p-4">
        <div class="flex items-center justify-between">
         <div class="flex items-center gap-3">
          <div
           class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"
          >
           <KeyRound class="h-5 w-5 text-primary" />
          </div>
          <div>
           <p class="font-medium">{{ supplier.supplier_name }}</p>
           <p class="text-sm text-muted-foreground">
            {{ supplier.username }}
           </p>
          </div>
         </div>
         <div class="flex items-center gap-2">
          <Badge :variant="getStatusConfig(supplier.last_login_status).variant">
           <component
            :is="getStatusConfig(supplier.last_login_status).icon"
            class="h-3 w-3 mr-1"
           />
           {{ getStatusConfig(supplier.last_login_status).label }}
          </Badge>
          <Button
           variant="ghost"
           size="icon"
           :disabled="testingId === supplier.credential_id"
           :aria-label="`Test ${supplier.supplier_name} credentials`"
           @click="handleTest(supplier)"
          >
           <Loader2
            v-if="testingId === supplier.credential_id"
            class="h-4 w-4 animate-spin"
           />
           <PlugZap v-else class="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" @click="handleEdit(supplier)">
           <Pencil class="h-4 w-4" />
          </Button>
          <AlertDialog>
           <AlertDialogTrigger as-child>
            <Button variant="ghost" size="icon">
             <Trash2 class="h-4 w-4 text-destructive" />
            </Button>
           </AlertDialogTrigger>
           <AlertDialogContent>
            <AlertDialogHeader>
             <AlertDialogTitle>Delete Credential</AlertDialogTitle>
             <AlertDialogDescription>
              Are you sure you want to delete the credentials for
              {{ supplier.supplier_name }}? This action cannot be undone.
             </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              @click="handleDelete(supplier.credential_id!)"
             >
              Delete
             </AlertDialogAction>
            </AlertDialogFooter>
           </AlertDialogContent>
          </AlertDialog>
         </div>
        </div>
       </CardContent>
      </Card>
     </div>
    </div>

    <!-- Unconfigured suppliers -->
    <div v-if="unconfiguredSuppliers.length > 0">
     <h4 class="text-sm font-medium text-muted-foreground mb-3">
      Available Suppliers ({{ unconfiguredSuppliers.length }})
     </h4>
     <div class="space-y-2">
      <Card
       v-for="supplier in unconfiguredSuppliers"
       :key="supplier.supplier_id"
       class="hover:bg-accent/50 transition-colors cursor-pointer"
       @click="handleAdd(supplier)"
      >
       <CardContent class="p-4">
        <div class="flex items-center justify-between">
         <div class="flex items-center gap-3">
          <div
           class="h-10 w-10 rounded-full bg-muted flex items-center justify-center"
          >
           <KeyRound class="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
           <p class="font-medium">{{ supplier.supplier_name }}</p>
           <p class="text-sm text-muted-foreground">
            No credentials configured
           </p>
          </div>
         </div>
         <Button variant="outline" size="sm">
          <Plus class="h-4 w-4 mr-1" />
          Add
         </Button>
        </div>
       </CardContent>
      </Card>
     </div>
    </div>
   </div>
  </div>
 </div>
</template>

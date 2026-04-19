<script setup lang="ts">
import { computed, toRef } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table'
import { Loader2, Save, Settings } from 'lucide-vue-next'
import { useCompanySupplierSettings } from '@/features/companySettings/composables/useCompanySupplierSettings'
import type { ThresholdSettingFormData } from '@/features/companySettings/types'
import { useAuthStore } from '@/stores/auth'

interface Props {
 companyId: string
}

const props = defineProps<Props>()

const companyIdRef = toRef(props, 'companyId')
const authStore = useAuthStore()
const {
 suppliersWithSettings,
 isLoading,
 isSaving,
 fetchSuppliersWithSettings,
 saveAllSettings,
 updateLocalSetting,
} = useCompanySupplierSettings(companyIdRef)

const canManageAdvancedSettings = computed(
 () => authStore.userRole === 'master',
)

// Fetch data on mount
await fetchSuppliersWithSettings()

// Handle threshold input change
const handleThresholdChange = (supplierId: string, value: string) => {
 const numValue = parseFloat(value) || 0
 // Clamp between 0 and 100
 const clampedValue = Math.min(100, Math.max(0, numValue))
 updateLocalSetting(supplierId, 'threshold_percentage', clampedValue)
}

// Handle active toggle
const handleActiveToggle = (supplierId: string, value: boolean) => {
 if (!canManageAdvancedSettings.value) return
 updateLocalSetting(supplierId, 'is_active', value)
}

const handleSpecialPricingToggle = (supplierId: string, value: boolean) => {
 if (!canManageAdvancedSettings.value) return
 updateLocalSetting(supplierId, 'special_pricing_enabled', value)
}

// Save all settings
const handleSaveAll = async () => {
 const settings: ThresholdSettingFormData[] = suppliersWithSettings.value.map(
  (s) => ({
   supplier_id: s.supplier_id,
   threshold_percentage: s.threshold_percentage,
   special_pricing_enabled: s.special_pricing_enabled,
   is_active: s.is_active,
  }),
 )
 await saveAllSettings(settings)
}

const hasSuppliers = computed(() => suppliersWithSettings.value.length > 0)
</script>

<template>
 <!-- Loading state -->
 <div v-if="isLoading" class="flex items-center justify-center py-12">
  <div
   class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"
  />
 </div>

 <!-- Empty state -->
 <div
  v-else-if="!hasSuppliers"
  class="flex flex-col items-center justify-center py-12 text-center"
 >
  <Settings class="h-12 w-12 text-muted-foreground mb-4" />
  <h3 class="text-lg font-medium">No suppliers available</h3>
  <p class="text-sm text-muted-foreground">
   There are no active suppliers in the system
  </p>
 </div>

 <!-- Settings table -->
 <div v-else class="space-y-4">
  <Table>
   <TableHeader>
    <TableRow>
     <TableHead class="w-[50%]">Supplier</TableHead>
     <TableHead class="w-[25%] text-center">Threshold %</TableHead>
     <TableHead class="w-[15%] text-center">Special Pricing</TableHead>
     <TableHead class="w-[10%] text-center">Active</TableHead>
    </TableRow>
   </TableHeader>
   <TableBody>
    <TableRow
     v-for="supplier in suppliersWithSettings"
     :key="supplier.supplier_id"
    >
     <TableCell class="font-medium">
      {{ supplier.supplier_name }}
     </TableCell>
     <TableCell>
      <div class="flex items-center justify-center gap-2">
       <Input
        type="number"
        :model-value="supplier.threshold_percentage"
        class="w-20 text-center"
        min="0"
        max="100"
        step="1"
        @update:model-value="
         (val) => handleThresholdChange(supplier.supplier_id, String(val))
        "
       />
       <span class="text-muted-foreground">%</span>
      </div>
     </TableCell>
     <TableCell class="text-center">
      <Switch
       :model-value="supplier.special_pricing_enabled"
       :disabled="!canManageAdvancedSettings || !supplier.is_active"
       @update:model-value="
        (val) => handleSpecialPricingToggle(supplier.supplier_id, val)
       "
      />
     </TableCell>
     <TableCell class="text-center">
      <Switch
       :model-value="supplier.is_active"
       :disabled="!canManageAdvancedSettings"
       @update:model-value="
        (val) => handleActiveToggle(supplier.supplier_id, val)
       "
      />
     </TableCell>
    </TableRow>
   </TableBody>
  </Table>

  <!-- Save button -->
  <div class="flex justify-end pt-4 border-t">
   <Button @click="handleSaveAll" :disabled="isSaving">
    <Loader2 v-if="isSaving" class="mr-2 h-4 w-4 animate-spin" />
    <Save v-else class="mr-2 h-4 w-4" />
    {{ isSaving ? 'Saving...' : 'Save All Changes' }}
   </Button>
  </div>
 </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
 Sheet,
 SheetContent,
 SheetDescription,
 SheetHeader,
 SheetTitle,
 SheetFooter,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
 Select,
 SelectContent,
 SelectGroup,
 SelectItem,
 SelectLabel,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select'
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
 AlertTriangle,
 Building2,
 MapPin,
 Package,
 Loader2,
 Send,
 Calculator,
 ShoppingCart,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/lib/apiClient'
import { useOrderSubmission } from '../composables/useOrderSubmission'

interface LocationApiRow {
 id: string
 name: string
 location_number: number
 company_id: string
 company: { id: string; name: string } | null
}
import { usePriceCheck } from '../composables/usePriceCheck'
import type { LocationOption } from '../types'
import {
 calculateTotalSavings,
 calculateTotalOrderCost,
 calculateTotalSupplierCost,
} from '../utils/orderBuilder'

interface Props {
 companyId: string
 locationId?: string
}

const props = defineProps<Props>()

const authStore = useAuthStore()

const {
 showSubmitDialog,
 closeSubmitDialog,
 selectionsBySupplier,
 selectionsArray,
 totalSelectedItems,
 isSubmitting,
 submitError,
 validate,
 submit,
 openResultsDialog,
 setSelectedLocation,
} = useOrderSubmission()

// Location state
const locations = ref<LocationOption[]>([])
const locationsByCompany = ref<Map<string, LocationOption[]>>(new Map())
const isLoadingLocations = ref(false)
const selectedLocationId = ref<string>('')

const isLocationLocked = computed(() => {
 return (
  !!props.locationId ||
  (authStore.userRole === 'manager' && locations.value.length === 1)
 )
})

// Validation warnings — driven by backend-declared supplier_constraints,
// not by hardcoded supplier names.
const { supplierConstraints } = usePriceCheck()
const validationResult = computed(() => validate(supplierConstraints.value))

// Totals
const totalOrderCost = computed(() =>
 calculateTotalOrderCost(selectionsArray.value),
)
const totalSupplierCost = computed(() =>
 calculateTotalSupplierCost(selectionsArray.value),
)
const totalSavings = computed(() =>
 calculateTotalSavings(selectionsArray.value),
)

// Supplier count
const supplierCount = computed(() => selectionsBySupplier.value.size)

// Format currency
const formatCurrency = (amount: number): string => {
 return new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
 }).format(amount)
}

// Load locations based on user role
async function loadLocations() {
 isLoadingLocations.value = true

 try {
  const role = authStore.userRole

  if (role === 'manager') {
   // Manager can only see their own location
   if (authStore.locationId) {
    const res = await apiClient.get<LocationApiRow>(
     `/locations/${encodeURIComponent(authStore.locationId)}`,
    )

    if (res.success && res.data) {
     const data = res.data
     locations.value = [
      {
       id: data.id,
       name: data.name,
       location_number: data.location_number,
      },
     ]
     selectedLocationId.value = props.locationId ?? data.id
    }
   }
  } else if (role === 'admin') {
   // Admin can see all locations for their company
   if (!authStore.companyId) return

   const res = await apiClient.get<LocationApiRow[]>(
    `/locations?activeOnly=true&companyId=${encodeURIComponent(authStore.companyId)}`,
   )

   if (res.success) {
    const data = res.data ?? []
    locations.value = data.map((l) => ({
     id: l.id,
     name: l.name,
     location_number: l.location_number,
    }))
    // Pre-select explicit location, user location, or first
    if (props.locationId) {
     selectedLocationId.value = props.locationId
    } else if (authStore.locationId) {
     selectedLocationId.value = authStore.locationId
    } else if (data.length > 0 && data[0]) {
     selectedLocationId.value = data[0].id
    }
   }
  } else if (role === 'master') {
   // Master can see all locations grouped by company
   const res = await apiClient.get<LocationApiRow[]>(
    `/locations?withCompany=true&activeOnly=true`,
   )
   const data = res.success ? (res.data ?? null) : null

   if (data) {
    const grouped = new Map<string, LocationOption[]>()

    for (const l of data) {
     const companyName = l.company?.name || 'Unknown'
     const companyIdVal = l.company?.id || l.company_id

     const location: LocationOption = {
      id: l.id,
      name: l.name,
      location_number: l.location_number,
      company_id: companyIdVal,
      company_name: companyName,
     }

     const list = grouped.get(companyName) || []
     list.push(location)
     grouped.set(companyName, list)

     locations.value.push(location)
    }

    locationsByCompany.value = grouped

    // Pre-select user's location if available
    if (props.locationId) {
     selectedLocationId.value = props.locationId
    } else if (authStore.locationId) {
     selectedLocationId.value = authStore.locationId
    } else if (locations.value.length > 0 && locations.value[0]) {
     selectedLocationId.value = locations.value[0].id
    }
   }
  }
 } catch (err) {
  console.error('Error loading locations:', err)
 } finally {
  isLoadingLocations.value = false
 }
}

// Update selected location when ID changes
watch(selectedLocationId, (newId) => {
 const location = locations.value.find((l) => l.id === newId) || null
 setSelectedLocation(location)
})

watch(
 () => props.locationId,
 (newId) => {
  if (!newId) return
  if (locations.value.length === 0) return
  if (locations.value.some((l) => l.id === newId)) {
   selectedLocationId.value = newId
  }
 },
)

// Handle submission
async function handleSubmit() {
 if (!selectedLocationId.value || !props.companyId) return

 const success = await submit(props.companyId, selectedLocationId.value)

 if (success) {
  closeSubmitDialog()
  openResultsDialog()
 }
}

// Load locations when dialog opens
watch(showSubmitDialog, (isOpen) => {
 if (isOpen && locations.value.length === 0) {
  loadLocations()
 }
})

onMounted(() => {
 if (showSubmitDialog.value) {
  loadLocations()
 }
})
</script>

<template>
 <Sheet :open="showSubmitDialog" @update:open="closeSubmitDialog">
  <SheetContent class="sm:max-w-[700px] flex flex-col p-0">
   <SheetHeader class="px-6 py-6">
    <SheetTitle>Review Order</SheetTitle>
    <SheetDescription>
     Review your selections before submitting to suppliers
    </SheetDescription>
   </SheetHeader>

   <div class="flex-1 overflow-hidden px-6">
    <Tabs default-value="items" class="h-full flex flex-col">
     <TabsList class="grid w-full grid-cols-3">
      <TabsTrigger value="items" class="flex items-center gap-2">
       <Package class="h-4 w-4" />
       Items
       <Badge variant="secondary" class="ml-1">
        {{ totalSelectedItems }}
       </Badge>
      </TabsTrigger>
      <TabsTrigger value="summary" class="flex items-center gap-2">
       <Calculator class="h-4 w-4" />
       Summary
      </TabsTrigger>
      <TabsTrigger value="settings" class="flex items-center gap-2">
       <MapPin class="h-4 w-4" />
       Location
      </TabsTrigger>
     </TabsList>

     <!-- Items Tab -->
     <TabsContent
      value="items"
      class="flex-1 overflow-auto mt-4 space-y-4 pr-2"
     >
      <!-- Warnings -->
      <div
       v-if="validationResult.warnings.length > 0"
       class="bg-warning/10 border border-warning/30 rounded-lg p-3 space-y-2"
      >
       <div class="flex items-center gap-2 text-warning font-medium text-sm">
        <AlertTriangle class="h-4 w-4" />
        <span>Warnings</span>
       </div>
       <ul class="text-sm text-warning space-y-1">
        <li v-for="(warning, index) in validationResult.warnings" :key="index">
         {{ warning.message }}
        </li>
       </ul>
      </div>

      <!-- Order Items by Supplier -->
      <div
       v-for="[supplierId, items] in selectionsBySupplier"
       :key="supplierId"
       class="border rounded-lg overflow-hidden"
      >
       <!-- Supplier Header -->
       <div class="bg-muted/50 px-4 py-2.5 flex items-center justify-between">
        <span class="font-medium">
         {{ items[0]?.supplier_name || 'Unknown Supplier' }}
        </span>
        <Badge variant="secondary">
         {{ items.length }} {{ items.length === 1 ? 'item' : 'items' }}
        </Badge>
       </div>

       <!-- Items Table -->
       <Table>
        <TableHeader>
         <TableRow>
          <TableHead>Product</TableHead>
          <TableHead class="text-center w-16">Qty</TableHead>
          <TableHead class="text-right w-24">Price</TableHead>
          <TableHead class="text-right w-24">Savings</TableHead>
         </TableRow>
        </TableHeader>
        <TableBody>
         <TableRow v-for="item in items" :key="item.product_id">
          <TableCell>
           <div class="text-sm font-medium truncate max-w-[220px]">
            {{ item.description }}
           </div>
           <div class="text-xs text-muted-foreground font-mono">
            {{ item.article_code }}
           </div>
          </TableCell>
          <TableCell class="text-center">
           {{ item.quantity }}
          </TableCell>
          <TableCell class="text-right">
           {{ formatCurrency(item.supplier_unit_price) }}
          </TableCell>
          <TableCell class="text-right">
           <span v-if="item.savings > 0" class="text-success font-medium">
            {{ formatCurrency(item.savings) }}
           </span>
           <span v-else class="text-muted-foreground">-</span>
          </TableCell>
         </TableRow>
        </TableBody>
       </Table>
      </div>

      <!-- Empty State -->
      <div
       v-if="selectionsBySupplier.size === 0"
       class="flex flex-col items-center justify-center py-12 text-muted-foreground"
      >
       <ShoppingCart class="h-12 w-12 mb-4 opacity-50" />
       <p>No items selected</p>
      </div>
     </TabsContent>

     <!-- Summary Tab -->
     <TabsContent
      value="summary"
      class="flex-1 overflow-auto mt-4 space-y-4 pr-2"
     >
      <!-- Stats Cards -->
      <div class="grid grid-cols-2 gap-4">
       <Card>
        <CardContent class="pt-6">
         <div class="text-2xl font-bold">{{ totalSelectedItems }}</div>
         <p class="text-xs text-muted-foreground">Total Items</p>
        </CardContent>
       </Card>
       <Card>
        <CardContent class="pt-6">
         <div class="text-2xl font-bold">{{ supplierCount }}</div>
         <p class="text-xs text-muted-foreground">Suppliers</p>
        </CardContent>
       </Card>
      </div>

      <!-- Cost Breakdown -->
      <Card>
       <CardContent class="pt-6 space-y-4">
        <h4 class="font-medium text-sm">Cost Breakdown</h4>

        <div class="space-y-3">
         <div class="flex justify-between text-sm">
          <span class="text-muted-foreground">Original Order Cost:</span>
          <span class="font-medium">{{ formatCurrency(totalOrderCost) }}</span>
         </div>
         <div class="flex justify-between text-sm">
          <span class="text-muted-foreground">Supplier Cost:</span>
          <span class="font-medium text-success">
           {{ formatCurrency(totalSupplierCost) }}
          </span>
         </div>
         <div class="border-t pt-3">
          <div class="flex justify-between">
           <span class="font-semibold">Total Savings:</span>
           <span class="font-bold text-lg text-success">
            {{ formatCurrency(totalSavings) }}
           </span>
          </div>
         </div>
        </div>
       </CardContent>
      </Card>

      <!-- Savings by Supplier -->
      <Card>
       <CardContent class="pt-6 space-y-4">
        <h4 class="font-medium text-sm">Savings by Supplier</h4>

        <div class="space-y-2">
         <div
          v-for="[supplierId, items] in selectionsBySupplier"
          :key="supplierId"
          class="flex justify-between items-center text-sm"
         >
          <span class="text-muted-foreground">
           {{ items[0]?.supplier_name || 'Unknown' }}
          </span>
          <div class="flex items-center gap-2">
           <Badge variant="outline" class="font-mono">
            {{ items.length }} items
           </Badge>
           <span class="font-medium text-success">
            {{ formatCurrency(items.reduce((sum, i) => sum + i.savings, 0)) }}
           </span>
          </div>
         </div>
        </div>
       </CardContent>
      </Card>
     </TabsContent>

     <!-- Location Tab -->
     <TabsContent
      value="settings"
      class="flex-1 overflow-auto mt-4 space-y-4 pr-2"
     >
      <Card>
       <CardContent class="pt-6 space-y-4">
        <div class="space-y-2">
         <label class="text-sm font-medium flex items-center gap-2">
          <MapPin class="h-4 w-4" />
          Select Location
         </label>

         <Select
          v-model="selectedLocationId"
          :disabled="isLoadingLocations || isLocationLocked"
         >
          <SelectTrigger class="w-full">
           <SelectValue placeholder="Select a location..." />
          </SelectTrigger>
          <SelectContent>
           <!-- Master role: grouped by company -->
           <template v-if="authStore.userRole === 'master'">
            <SelectGroup
             v-for="[companyName, companyLocations] in locationsByCompany"
             :key="companyName"
            >
             <SelectLabel class="flex items-center gap-2">
              <Building2 class="h-3 w-3" />
              {{ companyName }}
             </SelectLabel>
             <SelectItem
              v-for="location in companyLocations"
              :key="location.id"
              :value="location.id"
             >
              {{ location.name }} (#{{ location.location_number }})
             </SelectItem>
            </SelectGroup>
           </template>

           <!-- Admin/Manager: flat list -->
           <template v-else>
            <SelectItem
             v-for="location in locations"
             :key="location.id"
             :value="location.id"
            >
             {{ location.name }} (#{{ location.location_number }})
            </SelectItem>
           </template>
          </SelectContent>
         </Select>

         <p class="text-xs text-muted-foreground">
          Orders will use credentials configured for this location
         </p>
        </div>
       </CardContent>
      </Card>

      <!-- Info Card -->
      <Card class="bg-muted/30">
       <CardContent class="pt-6">
        <div class="flex items-start gap-3">
         <Building2 class="h-5 w-5 text-muted-foreground mt-0.5" />
         <div class="space-y-1">
          <p class="text-sm font-medium">About Locations</p>
          <p class="text-xs text-muted-foreground">
           Each location has its own supplier credentials. Make sure you select
           the correct location for this order.
          </p>
         </div>
        </div>
       </CardContent>
      </Card>
     </TabsContent>
    </Tabs>
   </div>

   <!-- Error Display -->
   <div v-if="submitError" class="px-6 py-2">
    <div class="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
     <p class="text-sm text-destructive">{{ submitError }}</p>
    </div>
   </div>

   <SheetFooter class="px-6 py-6 border-t">
    <Button variant="outline" @click="closeSubmitDialog">Cancel</Button>
    <Button
     :disabled="isSubmitting || !selectedLocationId || totalSelectedItems === 0"
     @click="handleSubmit"
    >
     <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
     <Send v-else class="mr-2 h-4 w-4" />
     {{ isSubmitting ? 'Submitting...' : 'Submit Order' }}
    </Button>
   </SheetFooter>
  </SheetContent>
 </Sheet>
</template>

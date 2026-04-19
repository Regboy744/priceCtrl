<script setup lang="ts">
import {
 Sheet,
 SheetContent,
 SheetDescription,
 SheetHeader,
 SheetTitle,
 SheetFooter,
} from '@/components/ui/sheet'
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table'
import {
 Collapsible,
 CollapsibleContent,
 CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
 Barcode,
 CheckCircle2,
 XCircle,
 ExternalLink,
 ChevronDown,
 AlertTriangle,
 Package,
 ShoppingCart,
 KeyRound,
 Settings,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useOrderSubmission } from '../composables/useOrderSubmission'
import { useAuthStore } from '@/stores/auth'
import { computed, ref } from 'vue'
import { orderDetailQuery } from '@/features/orders/api/queries'
import type { OrderDetail } from '@/features/orders/types'
import OrderBarcodeSheet from '@/features/orders/components/OrderBarcodeSheet.vue'

const router = useRouter()
const authStore = useAuthStore()

const {
 showResultsDialog,
 closeResultsDialog,
 submitResult,
 selectedLocation,
 openBasket,
 openBaskets,
 clearSelections,
} = useOrderSubmission()

// Track expanded supplier details
const expandedSuppliers = ref<Set<string>>(new Set())
const barcodeSheetOpen = ref(false)
const barcodeOrder = ref<OrderDetail | null>(null)
const isLoadingBarcodeOrder = ref(false)
const barcodeOrderError = ref<string | null>(null)

// Computed: has any successful results
const hasSuccessfulResults = computed(() => {
 if (!submitResult.value) return false
 return submitResult.value.results.some((r) => r.success || r.items_added > 0)
})

// Computed: has any failed items
const hasFailedItems = computed(() => {
 if (!submitResult.value) return false
 return submitResult.value.results.some((r) => r.items_failed > 0)
})

// Computed: are ALL failures due to missing credentials
const allFailuresAreCredentialErrors = computed(() => {
 if (!submitResult.value) return false
 const failedResults = submitResult.value.results.filter((r) => !r.success)
 if (failedResults.length === 0) return false
 return failedResults.every((r) => r.error_type === 'missing_credentials')
})

// Computed: company ID for settings navigation
const companyId = computed(() => {
 return selectedLocation.value?.company_id ?? authStore.companyId
})

const canOpenBarcodes = computed(() => {
 if (!submitResult.value) return false

 const hasPersistedItems =
  typeof submitResult.value.persisted_items_count === 'number'
   ? submitResult.value.persisted_items_count > 0
   : submitResult.value.summary.total_items_added > 0

 return Boolean(submitResult.value.order_id && hasPersistedItems)
})

// Navigate to company settings where credentials are managed
function goToCompanySettings() {
 if (!companyId.value) return
 handleClose()
 router.push(`/app/companies/${companyId.value}?tab=locations`)
}

// Toggle supplier details
function toggleSupplierDetails(supplierId: string) {
 if (expandedSuppliers.value.has(supplierId)) {
  expandedSuppliers.value.delete(supplierId)
 } else {
  expandedSuppliers.value.add(supplierId)
 }
 expandedSuppliers.value = new Set(expandedSuppliers.value)
}

// Get failure reason display text
function getFailureReasonText(reason: string): string {
 const reasons: Record<string, string> = {
  invalid_sku: 'Invalid SKU',
  out_of_stock: 'Out of Stock',
  api_error: 'API Error',
  network_error: 'Network Error',
  unknown: 'Unknown Error',
 }
 return reasons[reason] || reason
}

// Handle close and cleanup
function handleClose() {
 barcodeSheetOpen.value = false
 barcodeOrder.value = null
 barcodeOrderError.value = null
 closeResultsDialog()
 // Clear selections after successful submission
 if (hasSuccessfulResults.value) {
  clearSelections()
 }
}

// Handle open all baskets
function handleOpenAllBaskets() {
 openBaskets()
}

async function handleOpenBarcodes() {
 const orderId = submitResult.value?.order_id

 if (!orderId) {
  barcodeOrderError.value =
   'No persisted order ID was returned. Open this order from the Orders page to print labels.'
  barcodeSheetOpen.value = true
  return
 }

 barcodeSheetOpen.value = true
 isLoadingBarcodeOrder.value = true
 barcodeOrderError.value = null

 try {
  const { data, error } = await orderDetailQuery(orderId)

  if (error) {
   barcodeOrder.value = null
   barcodeOrderError.value =
    error.message || 'Failed to load order labels for this submission.'
   return
  }

  if (!data) {
   barcodeOrder.value = null
   barcodeOrderError.value =
    'Order was not found. Please refresh and try again.'
   return
  }

  barcodeOrder.value = {
   ...data,
   order_items: data.order_items ?? [],
  } as OrderDetail

  if (barcodeOrder.value.order_items.length === 0) {
   barcodeOrderError.value =
    'This order has no persisted line items available for barcode labels.'
  }
 } catch (error) {
  barcodeOrder.value = null
  barcodeOrderError.value =
   error instanceof Error
    ? error.message
    : 'Unexpected error while loading barcode labels.'
 } finally {
  isLoadingBarcodeOrder.value = false
 }
}
</script>

<template>
 <Sheet :open="showResultsDialog" @update:open="handleClose">
  <SheetContent class="sm:max-w-[700px] overflow-y-auto">
   <SheetHeader>
    <SheetTitle class="flex items-center gap-2">
     <CheckCircle2 v-if="submitResult?.success" class="h-5 w-5 text-success" />
     <AlertTriangle v-else class="h-5 w-5 text-warning" />
     Order Submission Results
    </SheetTitle>
    <SheetDescription>
     <template v-if="submitResult?.success">
      All orders were submitted successfully
     </template>
     <template v-else-if="hasSuccessfulResults">
      Some orders were submitted with partial success
     </template>
     <template v-else> Order submission encountered errors </template>
    </SheetDescription>
   </SheetHeader>

   <div v-if="submitResult" class="py-4 space-y-6">
    <!-- Summary Stats -->
    <div class="grid grid-cols-3 gap-4">
     <div class="bg-muted/50 rounded-lg p-3 text-center">
      <div class="text-2xl font-bold">
       {{ submitResult.summary.total_suppliers }}
      </div>
      <div class="text-xs text-muted-foreground">Suppliers</div>
     </div>
     <div class="bg-success/10 rounded-lg p-3 text-center">
      <div class="text-2xl font-bold text-success">
       {{ submitResult.summary.total_items_added }}
      </div>
      <div class="text-xs text-muted-foreground">Items Added</div>
     </div>
     <div
      :class="[
       'rounded-lg p-3 text-center',
       submitResult.summary.total_items_failed > 0
        ? 'bg-destructive/10'
        : 'bg-muted/50',
      ]"
     >
      <div
       :class="[
        'text-2xl font-bold',
        submitResult.summary.total_items_failed > 0
         ? 'text-destructive'
         : 'text-muted-foreground',
       ]"
      >
       {{ submitResult.summary.total_items_failed }}
      </div>
      <div class="text-xs text-muted-foreground">Failed</div>
     </div>
    </div>

    <Separator />

    <!-- Results by Supplier -->
    <div class="space-y-3">
     <h3 class="font-medium flex items-center gap-2">
      <Package class="h-4 w-4" />
      Results by Supplier
     </h3>

     <div
      v-for="result in submitResult.results"
      :key="result.supplier_id"
      class="border rounded-lg overflow-hidden"
     >
      <!-- Supplier Header -->
      <div
       :class="[
        'px-4 py-3 flex items-center justify-between',
        result.success ? 'bg-success/5' : 'bg-destructive/5',
       ]"
      >
       <div class="flex items-center gap-3">
        <CheckCircle2 v-if="result.success" class="h-5 w-5 text-success" />
        <XCircle v-else class="h-5 w-5 text-destructive" />
        <div>
         <div class="font-medium">{{ result.supplier_name }}</div>
         <div class="text-xs text-muted-foreground">
          {{ result.items_added }}/{{ result.items_requested }} items added
         </div>
        </div>
       </div>

       <div class="flex items-center gap-2">
        <Button
         v-if="result.success || result.items_added > 0"
         variant="outline"
         size="sm"
         @click="openBasket(result.basket_url)"
        >
         <ExternalLink class="mr-1.5 h-3.5 w-3.5" />
         Open Basket
        </Button>
       </div>
      </div>

      <!-- Failed Items (if any) -->
      <Collapsible
       v-if="result.failed_items.length > 0"
       :open="expandedSuppliers.has(result.supplier_id)"
       @update:open="() => toggleSupplierDetails(result.supplier_id)"
      >
       <CollapsibleTrigger
        class="w-full px-4 py-2 bg-destructive/5 border-t flex items-center justify-between hover:bg-destructive/10 transition-colors"
       >
        <span class="text-sm text-destructive font-medium">
         {{ result.failed_items.length }} failed
         {{ result.failed_items.length === 1 ? 'item' : 'items' }}
        </span>
        <ChevronDown
         :class="[
          'h-4 w-4 transition-transform',
          expandedSuppliers.has(result.supplier_id) ? 'rotate-180' : '',
         ]"
        />
       </CollapsibleTrigger>

       <CollapsibleContent>
        <Table>
         <TableHeader>
          <TableRow>
           <TableHead>Product</TableHead>
           <TableHead class="text-center">Qty</TableHead>
           <TableHead>Reason</TableHead>
          </TableRow>
         </TableHeader>
         <TableBody>
          <TableRow v-for="(item, index) in result.failed_items" :key="index">
           <TableCell>
            <div class="text-sm">
             {{ item.product_name || 'Unknown Product' }}
            </div>
            <div class="text-xs text-muted-foreground font-mono">
             {{ item.supplier_product_code }}
            </div>
           </TableCell>
           <TableCell class="text-center">
            {{ item.quantity }}
           </TableCell>
           <TableCell>
            <Badge variant="destructive" class="text-xs">
             {{ getFailureReasonText(item.reason) }}
            </Badge>
            <div v-if="item.details" class="text-xs text-muted-foreground mt-1">
             {{ item.details }}
            </div>
           </TableCell>
          </TableRow>
         </TableBody>
        </Table>
       </CollapsibleContent>
      </Collapsible>

      <!-- Error message: Missing credentials -->
      <div
       v-if="result.error_type === 'missing_credentials' && !result.success"
       class="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-800"
      >
       <div class="flex items-start gap-3">
        <KeyRound
         class="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
        />
        <div class="space-y-1 min-w-0">
         <p class="text-sm font-medium text-amber-800 dark:text-amber-300">
          Missing Credentials
         </p>
         <p class="text-xs text-amber-700 dark:text-amber-400">
          No credentials configured for
          <span class="font-semibold">{{ result.supplier_name }}</span>
          <template v-if="selectedLocation">
           at
           <span class="font-semibold">{{
            selectedLocation.name
           }}</span> </template
          >. Please add supplier credentials for this location in your company
          settings.
         </p>
         <Button
          v-if="companyId"
          variant="outline"
          size="sm"
          class="mt-2 h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          @click="goToCompanySettings"
         >
          <Settings class="mr-1.5 h-3 w-3" />
          Go to Company Settings
         </Button>
        </div>
       </div>
      </div>

      <!-- Error message: Generic errors -->
      <div
       v-else-if="result.error && !result.success"
       class="px-4 py-2 bg-destructive/5 border-t text-sm text-destructive"
      >
       {{ result.error }}
      </div>
     </div>
    </div>

    <!-- Open All Baskets CTA -->
    <div
     v-if="hasSuccessfulResults"
     class="bg-primary/5 border border-primary/20 rounded-lg p-4"
    >
     <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
       <ShoppingCart class="h-5 w-5 text-primary" />
       <div>
        <div class="font-medium">Ready to Checkout</div>
        <div class="text-sm text-muted-foreground">
         Open supplier baskets to complete your orders
        </div>
       </div>
      </div>
      <div class="flex items-center gap-2">
       <Button
        variant="outline"
        :disabled="!canOpenBarcodes"
        @click="handleOpenBarcodes"
       >
        <Barcode class="mr-2 h-4 w-4" />
        View Barcodes
       </Button>
       <Button @click="handleOpenAllBaskets">
        <ExternalLink class="mr-2 h-4 w-4" />
        Open All Baskets
       </Button>
      </div>
     </div>
    </div>

    <!-- Warning for failed items: credential-specific -->
    <div
     v-if="hasFailedItems && allFailuresAreCredentialErrors"
     class="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3"
    >
     <div class="flex items-start gap-2">
      <KeyRound class="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
      <div class="text-sm text-amber-800 dark:text-amber-300">
       <p class="font-medium">Supplier credentials required</p>
       <p class="mt-1 text-amber-700 dark:text-amber-400">
        None of the selected suppliers have credentials configured for
        <template v-if="selectedLocation">
         <span class="font-semibold">{{ selectedLocation.name }}</span
         >.
        </template>
        <template v-else> this location. </template>
        Please add them in your company settings before submitting orders.
       </p>
       <Button
        v-if="companyId"
        variant="outline"
        size="sm"
        class="mt-2 h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
        @click="goToCompanySettings"
       >
        <Settings class="mr-1.5 h-3 w-3" />
        Go to Company Settings
       </Button>
      </div>
     </div>
    </div>

    <!-- Warning for failed items: generic -->
    <div
     v-else-if="hasFailedItems"
     class="bg-warning/10 border border-warning/30 rounded-lg p-3"
    >
     <div class="flex items-start gap-2">
      <AlertTriangle class="h-4 w-4 text-warning mt-0.5" />
      <div class="text-sm text-warning">
       <p class="font-medium">Some items could not be added</p>
       <p class="mt-1">
        Check the failed items above. You may need to add them manually or
        contact the supplier.
       </p>
      </div>
     </div>
    </div>
   </div>

   <SheetFooter>
    <Button variant="outline" @click="handleClose"> Close </Button>
   </SheetFooter>
  </SheetContent>
 </Sheet>

 <OrderBarcodeSheet
  v-model:open="barcodeSheetOpen"
  :order="barcodeOrder"
  :is-loading="isLoadingBarcodeOrder"
  :error="barcodeOrderError"
 />
</template>

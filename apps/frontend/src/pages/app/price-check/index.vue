<script setup lang="ts">
import { usePriceCheck } from '@/features/priceCheck/composables/usePriceCheck'
import { useOrderSubmission } from '@/features/priceCheck/composables/useOrderSubmission'
import OrderFileUpload from '@/features/priceCheck/components/OrderFileUpload.vue'
import PriceCheckSummary from '@/features/priceCheck/components/PriceCheckSummary.vue'
import PriceComparisonTable from '@/features/priceCheck/components/PriceComparisonTable.vue'
import ProductsNotFound from '@/features/priceCheck/components/ProductsNotFound.vue'
import OrderSelectionBar from '@/features/priceCheck/components/OrderSelectionBar.vue'
import OrderSubmissionDialog from '@/features/priceCheck/components/OrderSubmissionDialog.vue'
import OrderResultsDialog from '@/features/priceCheck/components/OrderResultsDialog.vue'
import { Button } from '@/components/ui/button'
import { AlertCircle, RotateCcw } from 'lucide-vue-next'
import { ref } from 'vue'

const {
 isLoading,
 error,
 hasResults,
 suppliers,
 products,
 summary,
 selectedProductsCount,
 totalProductsCount,
 parseResult,
 checkPrices,
 clearResults,
} = usePriceCheck()

const { reset: resetOrderSubmission } = useOrderSubmission()

// Track company/location IDs from upload
const currentCompanyId = ref<string>('')
const currentLocationId = ref<string>('')

const handleUpload = async (data: {
 file: File
 locationId: string
 companyId: string
}) => {
 currentCompanyId.value = data.companyId
 currentLocationId.value = data.locationId
 await checkPrices(data.file, data.locationId, data.companyId)
}

const handleClearResults = () => {
 clearResults()
 resetOrderSubmission()
 currentCompanyId.value = ''
 currentLocationId.value = ''
}
</script>

<template>
 <div>
  <!-- Header -->
  <header class="flex items-center justify-between mb-6">
   <div>
    <h1 class="text-2xl font-bold tracking-tight">Price Check</h1>
    <p class="text-sm text-muted-foreground mt-0.5">
     Compare supplier prices for your order
    </p>
   </div>
   <Button
    v-if="hasResults"
    variant="outline"
    size="sm"
    @click="handleClearResults"
   >
    <RotateCcw class="mr-2 h-4 w-4" />
    New Check
   </Button>
  </header>

  <!-- Error State -->
  <div
   v-if="error"
   class="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/5 mb-6"
  >
   <AlertCircle class="h-5 w-5 text-destructive shrink-0 mt-0.5" />
   <div class="flex-1 min-w-0">
    <p class="font-medium text-destructive text-sm">Something went wrong</p>
    <p class="text-sm text-muted-foreground mt-0.5">{{ error }}</p>
   </div>
   <Button variant="ghost" size="sm" @click="handleClearResults">
    Try Again
   </Button>
  </div>

  <!-- Upload Section -->
  <div v-if="!hasResults && !isLoading" class="max-w-lg mx-auto">
   <div class="bg-card border rounded-xl p-6 shadow-sm">
    <OrderFileUpload :is-loading="isLoading" @upload="handleUpload" />
   </div>
  </div>

  <!-- Loading State -->
  <div v-if="isLoading" class="flex flex-col items-center justify-center py-16">
   <div class="relative">
    <div class="h-12 w-12 rounded-full border-4 border-muted animate-pulse" />
    <div
     class="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"
    />
   </div>
   <p class="text-sm text-muted-foreground mt-4">Analyzing prices...</p>
   <p class="text-xs text-muted-foreground/70 mt-1">
    Comparing across all suppliers
   </p>
  </div>

  <!-- Results Section -->
  <div v-if="hasResults && summary" class="space-y-3">
   <!-- Summary Section -->
   <PriceCheckSummary
    :summary="summary"
    :suppliers="suppliers"
    :products="products"
    :parse-result="parseResult"
    :selected-count="selectedProductsCount"
    :total-count="totalProductsCount"
   />

   <!-- Issues (missing + unpriced), side-by-side on wide screens -->
   <div
    v-if="
     summary.counts.products_not_found.length > 0 ||
     (summary.counts.products_unpriced?.length ?? 0) > 0
    "
    class="grid gap-2 md:grid-cols-2"
   >
    <ProductsNotFound
     v-if="summary.counts.products_not_found.length > 0"
     :article-codes="summary.counts.products_not_found"
    />
    <ProductsNotFound
     v-if="(summary.counts.products_unpriced?.length ?? 0) > 0"
     :article-codes="summary.counts.products_unpriced ?? []"
     label="unpriced"
     description="No supplier in your catalog has pricing data for these products"
    />
   </div>

   <!-- Comparison Table -->
   <PriceComparisonTable
    :suppliers="suppliers"
    :products="products"
    :thresholds="summary.thresholds_applied ?? {}"
   />
  </div>

  <!-- Order Submission Components -->
  <OrderSelectionBar />
  <OrderSubmissionDialog
   v-if="hasResults"
   :company-id="currentCompanyId"
   :location-id="currentLocationId"
  />
  <OrderResultsDialog />
 </div>
</template>

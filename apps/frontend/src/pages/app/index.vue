<script setup lang="ts">
import ForecastWidget from '@/features/weather-forecast/components/ForecastWidget.vue'
import DashboardFilters from '@/features/dashboard/components/DashboardFilters.vue'
import DashboardKpis from '@/features/dashboard/components/DashboardKpis.vue'
import TopProductsPanel from '@/features/dashboard/components/TopProductsPanel.vue'
import SupplierPerformanceChart from '@/features/dashboard/components/SupplierPerformanceChart.vue'
import { useDashboard } from '@/features/dashboard/composables/useDashboard'
import { Button } from '@/components/ui/button'

//import WeatherWidget from '@/features/weather-forecast/components/WeatherWidget.vue'

// This overrides the page title with the meta title
definePage({
 meta: {
  title: 'Dashboard',
 },
})

const {
 role,
 companies,
 locations,
 filters,
 kpis,
 topProductsByUnits,
 topProductsBySpend,
 supplierSummary,
 dateError,
 showSelectCompanyMessage,
 showNoCompanyMessage,
 showEmptyPeriodMessage,
 isLoadingCompanies,
 isLoadingLocations,
 isLoadingDashboard,
 updateFilters,
 resetFilters,
 applyDatePreset,
 refreshDashboard,
} = useDashboard()
</script>

<template>
 <div class="space-y-6">
  <DashboardFilters
   :role="role"
   :filters="filters"
   :companies="companies"
   :locations="locations"
   :is-loading-companies="isLoadingCompanies"
   :is-loading-locations="isLoadingLocations"
   :date-error="dateError"
   @update:filters="updateFilters"
   @apply-preset="applyDatePreset"
   @reset="resetFilters"
   @refresh="refreshDashboard"
  />

  <div
   v-if="showSelectCompanyMessage"
   class="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg"
  >
   <p class="text-lg font-medium text-muted-foreground mb-2">
    Select a company to view dashboard
   </p>
   <p class="text-sm text-muted-foreground">
    Use the Company filter to get started
   </p>
  </div>

  <div
   v-else-if="showNoCompanyMessage"
   class="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg"
  >
   <p class="text-lg font-medium text-muted-foreground mb-2">
    Your account is not linked to a company
   </p>
   <p class="text-sm text-muted-foreground">
    Ask an admin to assign your profile to a company.
   </p>
  </div>

  <template v-else>
   <div
    v-if="showEmptyPeriodMessage"
    class="rounded-lg border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
   >
    <div>
     <p class="text-sm font-medium">No orders in this period</p>
     <p class="text-xs text-muted-foreground">
      Try switching to Last Month to see recent activity.
     </p>
    </div>
    <div class="flex items-center gap-2">
     <Button variant="outline" size="sm" @click="applyDatePreset('lastMonth')">
      Show Last Month
     </Button>
     <Button variant="ghost" size="sm" @click="applyDatePreset('week')">
      This Week
     </Button>
    </div>
   </div>

   <DashboardKpis :kpis="kpis" :is-loading="isLoadingDashboard" />

   <div class="grid gap-6 lg:grid-cols-2">
    <TopProductsPanel
     :top-by-units="topProductsByUnits"
     :top-by-spend="topProductsBySpend"
     :is-loading="isLoadingDashboard"
    />
    <SupplierPerformanceChart
     :data="supplierSummary"
     :is-loading="isLoadingDashboard"
    />
   </div>
  </template>

  <!-- Weather Forecast Widget -->
  <!-- <WeatherWidget /> -->
  <ForecastWidget />
 </div>
</template>

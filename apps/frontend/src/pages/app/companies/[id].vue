<script setup lang="ts">
import { computed, onUnmounted, ref, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
 ArrowLeft,
 Building2,
 Mail,
 Phone,
 Store,
 Settings,
 DollarSign,
 Pencil,
} from 'lucide-vue-next'
import { useCompanyDetail } from '@/features/companies/composables/useCompanyDetail'
import { useCompanyAddress } from '@/features/addresses/composables/useCompanyAddress'
import { usePageTitleStore } from '@/stores/pageTitle'
import { useAuthStore } from '@/stores/auth'
import { useErrorStore } from '@/stores/error'
import SharedSheet from '@/components/shared/SharedSheet.vue'
import CompanyEditForm from '@/features/companies/components/CompanyEditForm.vue'
import AddressCard from '@/features/addresses/components/AddressCard.vue'
import LocationsList from '@/features/locations/components/LocationsList.vue'
import ThresholdSettingsForm from '@/features/companySettings/components/ThresholdSettingsForm.vue'
import type { CompanyFormData } from '@/features/companies/types'

const route = useRoute('/app/companies/[id]')
const router = useRouter()
const pageTitleStore = usePageTitleStore()
const authStore = useAuthStore()
const errorStore = useErrorStore()

const validTabs = ['overview', 'locations', 'settings', 'special-prices']
const activeTab = ref(
 validTabs.includes(route.query.tab as string)
  ? (route.query.tab as string)
  : 'overview',
)

// Sync tab when navigating with ?tab= query param
watch(
 () => route.query.tab,
 (tab) => {
  if (typeof tab === 'string' && validTabs.includes(tab)) {
   activeTab.value = tab
  }
 },
)

const companyId = computed(() => route.params.id as string)
const companyIdRef = toRef(companyId)

const { company, isLoading, fetchCompany, updateCompany } =
 useCompanyDetail(companyIdRef)

const {
 address,
 isLoading: isAddressLoading,
 fetchAddress,
 saveAddress,
 removeAddress,
} = useCompanyAddress(companyIdRef)

const isReadOnly = computed(
 () => authStore.userRole === 'admin' || authStore.userRole === 'manager',
)

const hasFetched = ref(false)
const hasRedirected = ref(false)

const handleForbidden = (message: string) => {
 if (hasRedirected.value) return
 errorStore.setError({ error: message, customCode: 403 })
 hasRedirected.value = true
 router.push('/app/companies/error/forbidden')
}

const loadCompanyData = async () => {
 if (hasFetched.value) return
 hasFetched.value = true
 await Promise.all([fetchCompany(), fetchAddress()])

 if (company.value?.name) {
  pageTitleStore.setBreadcrumbLabel(company.value.name)
 }
}

// Clear breadcrumb on unmount
onUnmounted(() => {
 pageTitleStore.clearBreadcumbLabel()
})

watch(
 () => companyId.value,
 () => {
  hasFetched.value = false
  hasRedirected.value = false
 },
)

watch(
 () => [isReadOnly.value, authStore.companyId, companyId.value],
 async () => {
  if (isReadOnly.value) {
   if (!authStore.companyId) {
    handleForbidden('Your account is not linked to a company.')
    return
   }

   if (authStore.companyId !== companyId.value) {
    handleForbidden('You do not have access to this company.')
    return
   }
  }

  await loadCompanyData()
 },
 { immediate: true },
)

// Computed values for display
const brandDisplay = computed(() => {
 if (!company.value?.brands) return ''
 return company.value.brands.name
})

// Handle company update
async function handleSave(updatedCompany: CompanyFormData) {
 await updateCompany(updatedCompany)
 // Update breadcrumb if name changed
 if (company.value?.name) {
  pageTitleStore.setBreadcrumbLabel(company.value.name)
 }
}

// Handle address save
async function handleAddressSave(
 addressData: Parameters<typeof saveAddress>[0],
) {
 await saveAddress(addressData)
}

// Handle address delete
async function handleAddressDelete() {
 const confirmed = confirm('Are you sure you want to delete this address?')
 if (confirmed) {
  await removeAddress()
 }
}

function goBack() {
 router.push('/app/companies')
}
</script>

<template>
 <div v-if="isLoading" class="flex items-center justify-center h-64">
  <div
   class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"
  />
 </div>

 <div v-else-if="company" class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
   <div class="flex items-center gap-4">
    <Button variant="ghost" size="icon" @click="goBack">
     <ArrowLeft class="h-5 w-5" />
    </Button>
    <div>
     <div class="flex items-center gap-3">
      <h1 class="text-2xl font-bold">{{ company.name }}</h1>
      <Badge :variant="company.is_active ? 'default' : 'secondary'">
       {{ company.is_active ? 'Active' : 'Inactive' }}
      </Badge>
     </div>
     <p class="text-muted-foreground">{{ brandDisplay }}</p>
    </div>
   </div>
  </div>

  <!-- Tabs -->
  <Tabs v-model="activeTab" class="space-y-6">
   <TabsList class="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
    <TabsTrigger value="overview" class="flex items-center gap-2">
     <Building2 class="h-4 w-4" />
     <span class="hidden sm:inline">Overview</span>
    </TabsTrigger>
    <TabsTrigger value="locations" class="flex items-center gap-2">
     <Store class="h-4 w-4" />
     <span class="hidden sm:inline">Locations</span>
    </TabsTrigger>
    <TabsTrigger value="settings" class="flex items-center gap-2">
     <Settings class="h-4 w-4" />
     <span class="hidden sm:inline">Settings</span>
    </TabsTrigger>
    <TabsTrigger value="special-prices" class="flex items-center gap-2">
     <DollarSign class="h-4 w-4" />
     <span class="hidden sm:inline">Special Prices</span>
    </TabsTrigger>
   </TabsList>

   <!-- Overview Tab -->
   <TabsContent value="overview" class="space-y-6">
    <div class="grid gap-6 md:grid-cols-2">
     <!-- Company Info Card -->
     <Card>
      <CardHeader
       class="flex flex-row items-center justify-between space-y-0 pb-2"
      >
       <div>
        <CardTitle class="text-lg">Company Information</CardTitle>
        <CardDescription>Basic company details</CardDescription>
       </div>
       <SharedSheet
        v-if="!isReadOnly"
        trigger-label="Edit"
        :trigger-icon="false"
        title="Edit Company"
        description="Update company information"
       >
        <template #trigger>
         <Button variant="outline" size="sm">
          <Pencil class="h-4 w-4 mr-2" />
          Edit
         </Button>
        </template>
        <template #content="{ close }">
         <CompanyEditForm
          :company="company"
          @save="
           async (data) => {
            await handleSave(data)
            close()
           }
          "
         />
        </template>
       </SharedSheet>
      </CardHeader>
      <CardContent class="space-y-4">
       <div class="space-y-3">
        <div class="flex items-center gap-3">
         <Building2 class="h-4 w-4 text-muted-foreground" />
         <div>
          <p class="text-sm text-muted-foreground">Company Name</p>
          <p class="font-medium">{{ company.name }}</p>
         </div>
        </div>
        <Separator />
        <div class="flex items-center gap-3">
         <Mail class="h-4 w-4 text-muted-foreground" />
         <div>
          <p class="text-sm text-muted-foreground">Email</p>
          <p class="font-medium">{{ company.email || 'Not set' }}</p>
         </div>
        </div>
        <Separator />
        <div class="flex items-center gap-3">
         <Phone class="h-4 w-4 text-muted-foreground" />
         <div>
          <p class="text-sm text-muted-foreground">Phone</p>
          <p class="font-medium">{{ company.phone || 'Not set' }}</p>
         </div>
        </div>
       </div>
      </CardContent>
     </Card>

     <!-- Address Card (using new AddressCard component) -->
     <AddressCard
      :address="address"
      :is-loading="isAddressLoading"
      :read-only="isReadOnly"
      @save="handleAddressSave"
      @delete="handleAddressDelete"
     />
    </div>

    <!-- Quick Stats -->
    <div class="grid gap-4 md:grid-cols-3">
     <Card>
      <CardHeader class="pb-2">
       <CardDescription>Total Locations</CardDescription>
       <CardTitle class="text-3xl">0</CardTitle>
      </CardHeader>
      <CardContent>
       <p class="text-xs text-muted-foreground">Stores and offices</p>
      </CardContent>
     </Card>
     <Card>
      <CardHeader class="pb-2">
       <CardDescription>Subscription</CardDescription>
       <CardTitle class="text-3xl capitalize">
        {{ company.subscription_tier || 'Essential' }}
       </CardTitle>
      </CardHeader>
      <CardContent>
       <p class="text-xs text-muted-foreground">Current plan</p>
      </CardContent>
     </Card>
     <Card>
      <CardHeader class="pb-2">
       <CardDescription>Created</CardDescription>
       <CardTitle class="text-lg">
        {{
         new Date(company.created_at || '').toLocaleDateString('en-IE', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
         })
        }}
       </CardTitle>
      </CardHeader>
      <CardContent>
       <p class="text-xs text-muted-foreground">Registration date</p>
      </CardContent>
     </Card>
    </div>
   </TabsContent>

   <!-- Locations Tab -->
   <TabsContent value="locations" class="space-y-6">
    <Card>
     <CardHeader>
      <CardTitle>Locations</CardTitle>
      <CardDescription>
       Manage stores and offices for {{ company.name }}
      </CardDescription>
     </CardHeader>
     <CardContent>
      <Suspense>
       <LocationsList
        :company-id="companyId"
        :read-only="isReadOnly"
        :allow-credentials="true"
       />
       <template #fallback>
        <div class="flex items-center justify-center py-12">
         <div
          class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"
         />
        </div>
       </template>
      </Suspense>
     </CardContent>
    </Card>
   </TabsContent>

   <!-- Settings Tab -->
   <TabsContent value="settings" class="space-y-6">
    <Card>
     <CardHeader>
      <CardTitle>Price Comparison Thresholds</CardTitle>
      <CardDescription>
       Configure threshold percentages for supplier price comparisons. Products
       within the threshold will be considered as matching prices.
      </CardDescription>
     </CardHeader>
     <CardContent>
      <Suspense>
       <ThresholdSettingsForm :company-id="companyId" />
       <template #fallback>
        <div class="flex items-center justify-center py-12">
         <div
          class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"
         />
        </div>
       </template>
      </Suspense>
     </CardContent>
    </Card>

    <Card>
     <CardHeader>
      <CardTitle>Display Settings</CardTitle>
      <CardDescription>
       Customize how data is displayed for this company
      </CardDescription>
     </CardHeader>
     <CardContent>
      <div class="flex flex-col items-center justify-center py-8 text-center">
       <p class="text-sm text-muted-foreground">
        Display settings will be available soon
       </p>
      </div>
     </CardContent>
    </Card>
   </TabsContent>

   <!-- Special Prices Tab -->
   <TabsContent value="special-prices" class="space-y-6">
    <Card>
     <CardHeader class="flex flex-row items-center justify-between space-y-0">
      <div>
       <CardTitle>Special Prices</CardTitle>
       <CardDescription>
        Company-specific negotiated prices with suppliers
       </CardDescription>
      </div>
      <Button v-if="!isReadOnly">
       <DollarSign class="h-4 w-4 mr-2" />
       Add Special Price
      </Button>
     </CardHeader>
     <CardContent>
      <!-- Placeholder - Special prices list will go here -->
      <div class="flex flex-col items-center justify-center py-12 text-center">
       <DollarSign class="h-12 w-12 text-muted-foreground mb-4" />
       <h3 class="text-lg font-medium">No special prices configured</h3>
       <p class="text-sm text-muted-foreground mb-4">
        Add negotiated prices that override default supplier prices
       </p>
       <Button v-if="!isReadOnly" variant="outline">
        <DollarSign class="h-4 w-4 mr-2" />
        Add First Special Price
       </Button>
      </div>
     </CardContent>
    </Card>
   </TabsContent>
  </Tabs>
 </div>

 <!-- Company not found -->
 <div v-else class="flex flex-col items-center justify-center h-64">
  <Building2 class="h-12 w-12 text-muted-foreground mb-4" />
  <h2 class="text-xl font-semibold">Company not found</h2>
  <p class="text-muted-foreground mb-4">
   The company you're looking for doesn't exist
  </p>
  <Button @click="goBack">
   <ArrowLeft class="h-4 w-4 mr-2" />
   Back to Companies
  </Button>
 </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import {
 Select,
 SelectContent,
 SelectGroup,
 SelectLabel,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select'
import {
 Upload,
 FileSpreadsheet,
 X,
 Loader2,
 Building2,
 MapPin,
} from 'lucide-vue-next'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'

interface LocationRow {
 id: string
 name: string
 location_number: number
 company_id: string
 company: { id: string; name: string } | null
}

interface LocationOption {
 id: string
 name: string
 location_number: number
 company_id: string
 company_name?: string
}

interface Props {
 isLoading?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
 upload: [data: { file: File; locationId: string; companyId: string }]
}>()

const authStore = useAuthStore()

// State
const locations = ref<LocationOption[]>([])
const locationsByCompany = ref<Map<string, LocationOption[]>>(new Map())
const selectedLocationId = ref<string>('')
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const fileError = ref<string | null>(null)
const isLoadingCompanies = ref(false)
const locationError = ref<string | null>(null)

const selectedLocation = computed(
 () => locations.value.find((l) => l.id === selectedLocationId.value) || null,
)

const selectedCompanyName = computed(
 () => selectedLocation.value?.company_name || 'Unknown company',
)

const selectedCompanyId = computed(
 () => selectedLocation.value?.company_id || '',
)

// Computed
const canUpload = computed(() => {
 return (
  selectedLocationId.value &&
  selectedCompanyId.value &&
  selectedFile.value &&
  !fileError.value &&
  !locationError.value
 )
})

const fileSizeFormatted = computed(() => {
 if (!selectedFile.value) return ''
 const bytes = selectedFile.value.size
 if (bytes < 1024) return `${bytes} B`
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

const isLocationLocked = computed(
 () => authStore.userRole === 'manager' && locations.value.length === 1,
)

// Fetch locations on mount
onMounted(async () => {
 isLoadingCompanies.value = true
 try {
  const role = authStore.userRole

  if (role === 'manager') {
   if (!authStore.locationId) {
    locationError.value = 'Your account is not linked to a location.'
    return
   }

   const res = await apiClient.get<LocationRow>(
    `/locations/${encodeURIComponent(authStore.locationId)}?withCompany=true`,
   )

   if (!res.success || !res.data) {
    locationError.value = 'Your location could not be found.'
    return
   }

   const data = res.data
   const location: LocationOption = {
    id: data.id,
    name: data.name,
    location_number: data.location_number,
    company_id: data.company_id,
    company_name: data.company?.name || 'Unknown company',
   }

   locations.value = [location]
   selectedLocationId.value = location.id
   return
  }

  if (role === 'admin') {
   if (!authStore.companyId) {
    locationError.value = 'Your account is not linked to a company.'
    return
   }

   const res = await apiClient.get<LocationRow[]>(
    `/locations?withCompany=true&activeOnly=true&companyId=${encodeURIComponent(authStore.companyId)}`,
   )

   if (!res.success) throw new Error(res.error?.message ?? 'Failed to load')
   const mapped = (res.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    location_number: l.location_number,
    company_id: l.company_id,
    company_name: l.company?.name || 'Unknown company',
   }))

   locations.value = mapped
   if (mapped.length === 0) {
    locationError.value = 'No active locations found for your company.'
    return
   }
   if (authStore.locationId) {
    selectedLocationId.value = authStore.locationId
   } else if (mapped[0]) {
    selectedLocationId.value = mapped[0].id
   }
   return
  }

  const res = await apiClient.get<LocationRow[]>(
   `/locations?withCompany=true&activeOnly=true`,
  )

  if (!res.success) throw new Error(res.error?.message ?? 'Failed to load')

  const rows = res.data ?? []
  if (rows.length === 0) {
   locationError.value = 'No active locations available.'
   return
  }

  const grouped = new Map<string, LocationOption[]>()

  for (const l of rows) {
   const companyName = l.company?.name || 'Unknown company'
   const location: LocationOption = {
    id: l.id,
    name: l.name,
    location_number: l.location_number,
    company_id: l.company_id,
    company_name: companyName,
   }

   const list = grouped.get(companyName) || []
   list.push(location)
   grouped.set(companyName, list)
   locations.value.push(location)
  }

  locationsByCompany.value = grouped

  if (authStore.locationId) {
   selectedLocationId.value = authStore.locationId
  } else if (locations.value[0]) {
   selectedLocationId.value = locations.value[0].id
  }
 } catch (err) {
  console.error('Failed to fetch locations:', err)
  locationError.value = 'Failed to load locations. Please try again.'
 } finally {
  isLoadingCompanies.value = false
 }
})

// File handling
const handleFileSelect = () => {
 fileInput.value?.click()
}

const handleFileChange = (event: Event) => {
 const target = event.target as HTMLInputElement
 const file = target.files?.[0]

 if (!file) return

 // Validate file type
 const validTypes = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 ]
 const validExtensions = ['.xls', '.xlsx']
 const hasValidExtension = validExtensions.some((ext) =>
  file.name.toLowerCase().endsWith(ext),
 )

 if (!validTypes.includes(file.type) && !hasValidExtension) {
  fileError.value = 'Please upload an XLS or XLSX file'
  selectedFile.value = null
  return
 }

 // Validate file size (max 10MB)
 const maxSize = 10 * 1024 * 1024
 if (file.size > maxSize) {
  fileError.value = 'File size must be less than 10MB'
  selectedFile.value = null
  return
 }

 fileError.value = null
 selectedFile.value = file
}

const handleRemoveFile = () => {
 selectedFile.value = null
 fileError.value = null
 if (fileInput.value) {
  fileInput.value.value = ''
 }
}

const handleUpload = () => {
 if (!canUpload.value || !selectedFile.value) return

 emit('upload', {
  file: selectedFile.value,
  locationId: selectedLocationId.value,
  companyId: selectedCompanyId.value,
 })
}

// Drag and drop
const isDragging = ref(false)

const handleDragOver = (event: DragEvent) => {
 event.preventDefault()
 isDragging.value = true
}

const handleDragLeave = () => {
 isDragging.value = false
}

const handleDrop = (event: DragEvent) => {
 event.preventDefault()
 isDragging.value = false

 const file = event.dataTransfer?.files?.[0]
 if (file) {
  const mockEvent = {
   target: { files: [file] },
  } as unknown as Event
  handleFileChange(mockEvent)
 }
}
</script>

<template>
 <div class="space-y-5">
  <!-- Location Selection -->
  <div class="space-y-2">
   <label class="flex items-center gap-2 text-sm font-medium">
    <MapPin class="h-4 w-4 text-muted-foreground" />
    Location
   </label>
   <Select
    v-model="selectedLocationId"
    :disabled="isLoadingCompanies || isLocationLocked"
   >
    <SelectTrigger class="w-full">
     <SelectValue
      :placeholder="isLoadingCompanies ? 'Loading...' : 'Select location'"
     />
    </SelectTrigger>
    <SelectContent>
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
     <template v-else>
      <SelectGroup>
       <SelectItem
        v-for="location in locations"
        :key="location.id"
        :value="location.id"
       >
        {{ location.name }} (#{{ location.location_number }})
       </SelectItem>
      </SelectGroup>
     </template>
    </SelectContent>
   </Select>
   <p v-if="selectedLocation" class="text-xs text-muted-foreground">
    Company: <span class="font-medium">{{ selectedCompanyName }}</span> ·
    Location:
    <span class="font-medium">
     {{ selectedLocation.name }} (#{{ selectedLocation.location_number }})
    </span>
   </p>
   <p v-else class="text-xs text-muted-foreground">
    Price checks are scoped to a specific location.
   </p>
  </div>

  <!-- Hidden File Input -->
  <input
   ref="fileInput"
   type="file"
   accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
   class="hidden"
   @change="handleFileChange"
  />

  <!-- Drop Zone / File Display -->
  <div
   class="relative border-2 border-dashed rounded-lg transition-all cursor-pointer"
   :class="[
    isDragging
     ? 'border-primary bg-primary/5'
     : fileError
       ? 'border-destructive/50 bg-destructive/5'
       : selectedFile
         ? 'border-primary/50 bg-primary/5'
         : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
   ]"
   @click="handleFileSelect"
   @dragover="handleDragOver"
   @dragleave="handleDragLeave"
   @drop="handleDrop"
  >
   <!-- No file selected -->
   <div v-if="!selectedFile" class="p-6 text-center">
    <Upload
     class="w-8 h-8 mx-auto mb-2"
     :class="isDragging ? 'text-primary' : 'text-muted-foreground'"
    />
    <p class="text-sm font-medium">
     {{ isDragging ? 'Drop file here' : 'Upload order file' }}
    </p>
    <p class="text-xs text-muted-foreground mt-1">XLS or XLSX, max 10MB</p>
   </div>

   <!-- File selected -->
   <div v-else class="p-4 flex items-center gap-3">
    <div class="p-2 bg-primary/10 rounded-lg shrink-0">
     <FileSpreadsheet class="h-5 w-5 text-primary" />
    </div>
    <div class="flex-1 min-w-0">
     <p class="text-sm font-medium truncate">{{ selectedFile.name }}</p>
     <p class="text-xs text-muted-foreground">{{ fileSizeFormatted }}</p>
    </div>
    <Button
     variant="ghost"
     size="icon"
     class="h-8 w-8 shrink-0"
     @click.stop="handleRemoveFile"
    >
     <X class="h-4 w-4" />
    </Button>
   </div>
  </div>

  <!-- File Error -->
  <p v-if="locationError" class="text-xs text-destructive">
   {{ locationError }}
  </p>
  <p v-else-if="fileError" class="text-xs text-destructive">
   {{ fileError }}
  </p>

  <!-- Submit Button -->
  <Button
   class="w-full"
   size="lg"
   :disabled="!canUpload || isLoading"
   @click="handleUpload"
  >
   <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
   <Upload v-else class="mr-2 h-4 w-4" />
   {{ isLoading ? 'Checking Prices...' : 'Check Prices' }}
  </Button>
 </div>
</template>

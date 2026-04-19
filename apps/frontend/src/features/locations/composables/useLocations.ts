import { ref, type Ref } from 'vue'
import { useErrorStore } from '@/stores/error'
import {
 locationsByCompanyQuery,
 type LocationsByCompanyType,
} from '@/features/locations/api/queries'
import {
 createLocation,
 updateLocation,
 deleteLocation,
} from '@/features/locations/api/mutations'
import type {
 LocationInsert,
 LocationFormData,
 LocationUpdate,
} from '@/features/locations/types'

export const useLocations = (companyId: Ref<string>) => {
 const locations = ref<LocationsByCompanyType>([])
 const isLoading = ref(false)
 const errorStore = useErrorStore()

 // Fetch locations for a company
 const fetchLocations = async () => {
  isLoading.value = true
  try {
   const { data, error, status } = await locationsByCompanyQuery(
    companyId.value,
   )

   if (error) {
    errorStore.setError({ error, customCode: status })
    return null
   }

   locations.value = data ?? []
   return data
  } finally {
   isLoading.value = false
  }
 }

 // Save location (create or update)
 const saveLocation = async (location: LocationFormData) => {
  isLoading.value = true
  try {
   const isUpdate = 'id' in location && location.id

   const result = isUpdate
    ? await updateLocation(location.id!, location as LocationUpdate)
    : await createLocation({
       ...location,
       company_id: companyId.value,
      } as LocationInsert)

   if (!result.success) {
    errorStore.setError({
     error: result.error as Error,
     customCode: 500,
    })
    return false
   }

   // Refresh the list
   await fetchLocations()
   return true
  } finally {
   isLoading.value = false
  }
 }

 // Remove location
 const removeLocation = async (id: string) => {
  isLoading.value = true
  try {
   const result = await deleteLocation(id)

   if (!result.success) {
    errorStore.setError({
     error: result.error as Error,
     customCode: 500,
    })
    return false
   }

   // Refresh the list
   await fetchLocations()
   return true
  } finally {
   isLoading.value = false
  }
 }

 return {
  locations,
  isLoading,
  fetchLocations,
  saveLocation,
  removeLocation,
 }
}

import { ref, type Ref } from 'vue'
import { useErrorStore } from '@/stores/error'
import {
 locationCredentialsQuery,
 allSuppliersQuery,
 type LocationCredentialsType,
 type AllSuppliersType,
} from '@/features/locationCredentials/api/queries'
import {
 createCredential,
 updateCredential,
 deleteCredential,
 testCredential,
} from '@/features/locationCredentials/api/mutations'
import type {
 CredentialFormData,
 SupplierWithCredential,
} from '@/features/locationCredentials/types'

export const useLocationCredentials = (
 locationId: Ref<string>,
 companyId: Ref<string>,
) => {
 const credentials = ref<LocationCredentialsType>([])
 const suppliers = ref<AllSuppliersType>([])
 const suppliersWithCredentials = ref<SupplierWithCredential[]>([])
 const isLoading = ref(false)
 const errorStore = useErrorStore()

 // Fetch credentials for a location
 const fetchCredentials = async () => {
  isLoading.value = true
  try {
   const { data, error, status } = await locationCredentialsQuery(
    locationId.value,
   )

   if (error) {
    errorStore.setError({ error, customCode: status })
    return null
   }

   credentials.value = data ?? []
   return data
  } finally {
   isLoading.value = false
  }
 }

 // Fetch all active suppliers
 const fetchSuppliers = async () => {
  try {
   const { data, error, status } = await allSuppliersQuery()

   if (error) {
    errorStore.setError({ error, customCode: status })
    return null
   }

   suppliers.value = data ?? []
   return data
  } catch {
   return null
  }
 }

 // Build merged list of suppliers with their credential status
 const buildSuppliersWithCredentials = () => {
  suppliersWithCredentials.value = suppliers.value.map((supplier) => {
   const credential = credentials.value.find(
    (c) => c.supplier_id === supplier.id,
   )

   return {
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    credential_id: credential?.id ?? null,
    username: credential?.username ?? null,
    website_url: credential?.website_url ?? null,
    login_url: credential?.login_url ?? null,
    last_login_status: credential?.last_login_status ?? null,
    last_login_at: credential?.last_login_at ?? null,
    is_active: credential?.is_active ?? false,
   } as SupplierWithCredential
  })
 }

 // Load all data (credentials + suppliers) and build merged list
 const loadData = async () => {
  isLoading.value = true
  try {
   await Promise.all([fetchCredentials(), fetchSuppliers()])
   buildSuppliersWithCredentials()
  } finally {
   isLoading.value = false
  }
 }

 // Save credential (create or update)
 const saveCredential = async (
  data: CredentialFormData,
  credentialId?: string,
 ) => {
  isLoading.value = true
  try {
   const result = credentialId
    ? await updateCredential(credentialId, data)
    : await createCredential(locationId.value, companyId.value, data)

   if (!result.success) {
    errorStore.setError({
     error: result.error as Error,
     customCode: 500,
    })
    return false
   }

   // Refresh the list
   await fetchCredentials()
   buildSuppliersWithCredentials()
   return true
  } finally {
   isLoading.value = false
  }
 }

 // Remove credential
 const removeCredential = async (credentialId: string) => {
  isLoading.value = true
  try {
   const result = await deleteCredential(credentialId)

   if (!result.success) {
    errorStore.setError({
     error: result.error as Error,
     customCode: 500,
    })
    return false
   }

   // Refresh the list
   await fetchCredentials()
   buildSuppliersWithCredentials()
   return true
  } finally {
   isLoading.value = false
  }
 }

 const checkCredential = async (credentialId: string) => {
  const result = await testCredential(credentialId)
  if (!result.success) {
   errorStore.setError({
    error: result.error as Error,
    customCode: 500,
   })
   return { ok: false, error: result.error?.message }
  }
  // Refresh so badges reflect new last_login_status.
  await fetchCredentials()
  buildSuppliersWithCredentials()
  return result.data ?? { ok: false, error: 'No response' }
 }

 return {
  credentials,
  suppliers,
  suppliersWithCredentials,
  isLoading,
  loadData,
  fetchCredentials,
  fetchSuppliers,
  saveCredential,
  removeCredential,
  checkCredential,
 }
}

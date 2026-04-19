import { ref, type Ref } from 'vue'
import { useErrorStore } from '@/stores/error'
import {
 addressByCompanyQuery,
 type AddressByCompanyType,
} from '@/features/addresses/api/queries'
import {
 createAddress,
 updateAddress,
 deleteAddress,
} from '@/features/addresses/api/mutations'
import type {
 AddressInsert,
 AddressFormData,
 AddressUpdate,
} from '@/features/addresses/types'

export const useCompanyAddress = (companyId: Ref<string>) => {
 const address = ref<AddressByCompanyType | null>(null)
 const isLoading = ref(false)
 const errorStore = useErrorStore()

 // Fetch address for a company (single address)
 const fetchAddress = async () => {
  isLoading.value = true
  try {
   const { data, error, status } = await addressByCompanyQuery(companyId.value)

   if (error) {
    errorStore.setError({ error, customCode: status })
    return null
   }

   address.value = data
   return data
  } finally {
   isLoading.value = false
  }
 }

 // Save address (create or update)
 const saveAddress = async (addressData: AddressFormData) => {
  isLoading.value = true
  try {
   const isUpdate = 'id' in addressData && addressData.id

   const result = isUpdate
    ? await updateAddress(addressData.id!, addressData as AddressUpdate)
    : await createAddress({
       ...addressData,
       company_id: companyId.value,
      } as AddressInsert)

   if (!result.success) {
    errorStore.setError({
     error: result.error as Error,
     customCode: 500,
    })
    return false
   }

   // Refresh the address
   await fetchAddress()
   return true
  } finally {
   isLoading.value = false
  }
 }

 // Remove address
 const removeAddress = async () => {
  if (!address.value?.id) return false

  isLoading.value = true
  try {
   const result = await deleteAddress(address.value.id)

   if (!result.success) {
    errorStore.setError({
     error: result.error as Error,
     customCode: 500,
    })
    return false
   }

   // Clear the address
   address.value = null
   return true
  } finally {
   isLoading.value = false
  }
 }

 return {
  address,
  isLoading,
  fetchAddress,
  saveAddress,
  removeAddress,
 }
}

import { ref, type Ref } from 'vue'
import { useErrorStore } from '@/stores/error'
import {
 companyQuery,
 type CompanyType,
} from '@/features/companies/api/queries'
import { updateCompany as updateCompanyMutation } from '@/features/companies/api/mutations'
import type { CompanyFormData, CompanyUpdate } from '@/features/companies/types'

export const useCompanyDetail = (companyId: Ref<string>) => {
 const company = ref<CompanyType | null>(null)
 const isLoading = ref(false)
 const errorStore = useErrorStore()

 // Fetch single company
 const fetchCompany = async () => {
  isLoading.value = true
  try {
   const { data, error, status } = await companyQuery(companyId.value)

   if (error) {
    errorStore.setError({ error, customCode: status })
    return null
   }

   company.value = data
   return data
  } finally {
   isLoading.value = false
  }
 }

 // Update company
 const updateCompany = async (updatedData: CompanyFormData) => {
  isLoading.value = true
  try {
   if (!updatedData.id) {
    errorStore.setError({
     error: new Error('Company ID is required for update'),
     customCode: 400,
    })
    return false
   }

   const result = await updateCompanyMutation(
    updatedData.id,
    updatedData as CompanyUpdate,
   )

   if (!result.success) {
    errorStore.setError({
     error: result.error as Error,
     customCode: 500,
    })
    return false
   }

   // Refresh the company data
   await fetchCompany()
   return true
  } finally {
   isLoading.value = false
  }
 }

 return {
  company,
  isLoading,
  fetchCompany,
  updateCompany,
 }
}

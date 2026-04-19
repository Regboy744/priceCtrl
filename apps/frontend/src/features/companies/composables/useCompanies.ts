import { ref } from 'vue'
import { useErrorStore } from '@/stores/error'
import {
 companiesQuery,
 type CompaniesType,
} from '@/features/companies/api/queries'
import {
 createCompany,
 updateCompany,
 deleteCompany,
} from '@/features/companies/api/mutations'
import type {
 CompanyInsert,
 CompanyFormData,
 CompanyUpdate,
} from '@/features/companies/types'

export const useCompanies = () => {
 const companies = ref<CompaniesType | null>(null)
 const isLoading = ref(false)
 const errorStore = useErrorStore()

 // Fetch all companies
 const fetchCompanies = async () => {
  isLoading.value = true
  try {
   const { data, error, status } = await companiesQuery()

   if (error) {
    errorStore.setError({ error, customCode: status })
    return null
   }

   companies.value = data
   return data
  } finally {
   isLoading.value = false
  }
 }

 // Save company (create or update)
 const saveCompany = async (company: CompanyFormData) => {
  isLoading.value = true
  try {
   const isUpdate = 'id' in company && company.id

   const result = isUpdate
    ? await updateCompany(company.id!, company as CompanyUpdate)
    : await createCompany(company as CompanyInsert)

   if (!result.success) {
    errorStore.setError({
     error: result.error as Error,
     customCode: 500,
    })
    return false
   }

   // Refresh the list
   await fetchCompanies()
   return true
  } finally {
   isLoading.value = false
  }
 }

 // Delete company
 const removeCompany = async (id: string) => {
  isLoading.value = true
  try {
   const result = await deleteCompany(id)

   if (!result.success) {
    errorStore.setError({
     error: result.error as Error,
     customCode: 500,
    })
    return false
   }

   // Refresh the list
   await fetchCompanies()
   return true
  } finally {
   isLoading.value = false
  }
 }

 return {
  companies,
  isLoading,
  fetchCompanies,
  saveCompany,
  removeCompany,
 }
}

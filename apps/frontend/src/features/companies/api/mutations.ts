import { apiClient } from '@/lib/apiClient'
import type {
 Company,
 CompanyInsert,
 CompanyUpdate,
} from '@/features/companies/types'

interface MutationResult<T = Company> {
 success: boolean
 data?: T
 error?: Error
}

const toMutationResult = <T>(res: {
 success: boolean
 data?: T
 error?: { message: string }
}): MutationResult<T> => ({
 success: res.success,
 data: res.data,
 error: res.error ? new Error(res.error.message) : undefined,
})

// CREATE company
export const createCompany = async (
 company: CompanyInsert,
): Promise<MutationResult> => {
 const res = await apiClient.post<Company>('/companies', {
  name: company.name,
  brand_id: company.brand_id,
  phone: company.phone,
  email: company.email,
  is_active: company.is_active ?? true,
 })
 return toMutationResult(res)
}

// UPDATE company
export const updateCompany = async (
 id: string,
 company: CompanyUpdate,
): Promise<MutationResult> => {
 const res = await apiClient.patch<Company>(
  `/companies/${encodeURIComponent(id)}`,
  {
   name: company.name,
   brand_id: company.brand_id,
   phone: company.phone,
   email: company.email,
   is_active: company.is_active,
  },
 )
 return toMutationResult(res)
}

// DELETE company - Company is the root, when deleted
// everything related will be deleted via cascade
export const deleteCompany = async (
 id: string,
): Promise<MutationResult<null>> => {
 const res = await apiClient.delete<null>(
  `/companies/${encodeURIComponent(id)}`,
 )
 return toMutationResult(res)
}

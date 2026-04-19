import { apiClient } from '@/lib/apiClient'
import type { CredentialFormData } from '@/features/locationCredentials/types'

interface MutationResult<T = unknown> {
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

// CREATE credential (backend stores password in vault via RPC)
export const createCredential = async (
 locationId: string,
 companyId: string,
 data: CredentialFormData,
) => {
 const res = await apiClient.post<{ id: string }>('/location-credentials', {
  location_id: locationId,
  company_id: companyId,
  supplier_id: data.supplier_id,
  username: data.username,
  password: data.password || '',
  website_url: data.website_url || undefined,
  login_url: data.login_url || undefined,
 })
 return toMutationResult(res)
}

// UPDATE credential (backend optionally updates vault password via RPC)
export const updateCredential = async (
 credentialId: string,
 data: CredentialFormData,
) => {
 const res = await apiClient.patch<null>(
  `/location-credentials/${encodeURIComponent(credentialId)}`,
  {
   username: data.username,
   password: data.password || undefined,
   website_url: data.website_url || undefined,
   login_url: data.login_url || undefined,
   is_active: data.is_active,
  },
 )
 return toMutationResult(res)
}

// DELETE credential (backend removes vault secret via RPC)
export const deleteCredential = async (credentialId: string) => {
 const res = await apiClient.delete<null>(
  `/location-credentials/${encodeURIComponent(credentialId)}`,
 )
 return toMutationResult(res)
}

// TEST credential (backend runs supplier HTTP login and updates status)
export interface CredentialTestResult {
 ok: boolean
 error?: string
}

export const testCredential = async (credentialId: string) => {
 const res = await apiClient.post<CredentialTestResult>(
  `/location-credentials/${encodeURIComponent(credentialId)}/test`,
  {},
 )
 return toMutationResult<CredentialTestResult>(res)
}

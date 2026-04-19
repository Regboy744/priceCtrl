import { apiClient } from '@/lib/apiClient'
import type {
 MasterProduct,
 MasterProductInsert,
 MasterProductUpdate,
 CsvRow,
 UpsertResult,
 UpsertOptions,
 UpsertProgress,
} from '@/features/masterProducts/types'

interface MutationResult<T = MasterProduct> {
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

// Create a new master product
export const createMasterProduct = async (
 product: MasterProductInsert,
): Promise<MutationResult> => {
 const res = await apiClient.post<MasterProduct>('/master-products', product)
 return toMutationResult(res)
}

// Update an existing master product (backend handles ean_history)
export const updateMasterProduct = async (
 id: string,
 product: MasterProductUpdate,
): Promise<MutationResult> => {
 const res = await apiClient.patch<MasterProduct>(
  `/master-products/${encodeURIComponent(id)}`,
  product,
 )
 return toMutationResult(res)
}

// Soft delete a master product (set is_active = false)
export const deleteMasterProduct = async (
 id: string,
): Promise<MutationResult> => {
 const res = await apiClient.patch<MasterProduct>(
  `/master-products/${encodeURIComponent(id)}`,
  { is_active: false },
 )
 return toMutationResult(res)
}

// Reactivate a master product
export const reactivateMasterProduct = async (
 id: string,
): Promise<MutationResult> => {
 const res = await apiClient.patch<MasterProduct>(
  `/master-products/${encodeURIComponent(id)}`,
  { is_active: true },
 )
 return toMutationResult(res)
}

interface BulkCompletePayload {
 inserted: number
 skipped: number
 errors?: string[]
}

interface BulkProgressPayload {
 phase: UpsertProgress['phase']
 current: number
 total: number
 message: string
}

interface BulkPhasePayload {
 phase: UpsertProgress['phase']
 message: string
}

/**
 * Bulk insert master products via backend SSE stream.
 * Existing (brand_id + article_code) pairs are skipped, not updated.
 * Client can cancel via the signal; the backend aborts between batches.
 */
export const upsertMasterProducts = async (
 brandId: string,
 products: CsvRow[],
 options?: UpsertOptions,
): Promise<UpsertResult> => {
 const { onProgress, signal } = options || {}
 const abortController = new AbortController()

 let cancelWatcher: ReturnType<typeof setInterval> | null = null
 if (signal) {
  cancelWatcher = setInterval(() => {
   if (signal.cancelled) abortController.abort()
  }, 250)
 }

 let result: BulkCompletePayload | null = null as BulkCompletePayload | null
 let streamError: string | null = null

 try {
  const res = await apiClient.postStream(
   '/master-products/bulk-import',
   { brandId, rows: products },
   (event) => {
    if (event.event === 'phase') {
     const payload = event.data as BulkPhasePayload
     onProgress?.({
      phase: payload.phase,
      current: 0,
      total: 0,
      message: payload.message,
     })
    } else if (event.event === 'progress') {
     const payload = event.data as BulkProgressPayload
     onProgress?.(payload)
    } else if (event.event === 'complete') {
     result = event.data as BulkCompletePayload
     onProgress?.({
      phase: 'complete',
      current: result.inserted,
      total: result.inserted,
      message: 'Upload complete!',
     })
    } else if (event.event === 'error') {
     const payload = event.data as { message: string }
     streamError = payload.message
    }
   },
   { signal: abortController.signal },
  )

  if (!res.success && !result) {
   return {
    success: false,
    inserted: 0,
    skipped: 0,
    errors: [streamError ?? res.error?.message ?? 'Stream failed'],
   }
  }

  if (!result) {
   return {
    success: false,
    inserted: 0,
    skipped: 0,
    errors: [streamError ?? 'Stream closed without completion'],
   }
  }

  return {
   success: !result.errors || result.errors.length === 0,
   inserted: result.inserted,
   skipped: result.skipped,
   errors: result.errors,
  }
 } finally {
  if (cancelWatcher) clearInterval(cancelWatcher)
 }
}

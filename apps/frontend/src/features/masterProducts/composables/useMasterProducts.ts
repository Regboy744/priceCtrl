import { ref, computed } from 'vue'
import { useErrorStore } from '@/stores/error'
import {
 brandsQuery,
 masterProductsFilteredQuery,
} from '@/features/masterProducts/api/queries'
import type {
 MasterProductWithBrand,
 BrandOption,
 MasterProductFormData,
 CsvRow,
 CsvPreviewData,
 CsvPreviewItem,
 UpsertProgress,
} from '@/features/masterProducts/types'
import {
 createMasterProduct,
 updateMasterProduct,
 deleteMasterProduct,
 reactivateMasterProduct,
 upsertMasterProducts,
} from '@/features/masterProducts/api/mutations'

export const useMasterProducts = () => {
 const masterProducts = ref<MasterProductWithBrand[] | null>(null)
 const brands = ref<BrandOption[] | null>(null)
 const selectedBrandId = ref<string | null>(null)
 const articleCodeFilter = ref<string>('')
 const eanCodeFilter = ref<string>('')
 const descriptionFilter = ref<string>('')
 const isLoading = ref(false)
 const errorStore = useErrorStore()

 // Progress tracking for CSV upload
 const uploadProgress = ref<UpsertProgress | null>(null)
 const cancelSignal = ref<{ cancelled: boolean }>({ cancelled: false })

 // Fetch master products with server-side filters
 const fetchMasterProducts = async () => {
  isLoading.value = true
  try {
   const query = masterProductsFilteredQuery({
    brandId: selectedBrandId.value,
    articleCode: articleCodeFilter.value || null,
    eanCode: eanCodeFilter.value || null,
    description: descriptionFilter.value || null,
    limit: 100,
   })

   const { data, error, status } = await query

   if (error) {
    errorStore.setError({ error, customCode: status })
    return null
   }

   masterProducts.value = data as MasterProductWithBrand[]
   return data
  } finally {
   isLoading.value = false
  }
 }

 // Fetch all brands for dropdown
 const fetchBrands = async () => {
  try {
   const { data, error, status } = await brandsQuery()

   if (error) {
    errorStore.setError({ error, customCode: status })
    return null
   }

   brands.value = data
   return data
  } catch (err) {
   console.error('Error fetching brands:', err)
   return null
  }
 }

 // Save master product (create or update)
 const saveMasterProduct = async (formData: MasterProductFormData) => {
  const isUpdate = 'id' in formData && formData.id

  const result = isUpdate
   ? await updateMasterProduct(formData.id!, {
      article_code: formData.article_code,
      ean_code: formData.ean_code,
      description: formData.description,
      account: formData.account,
      unit_size: formData.unit_size,
      is_active: formData.is_active,
     })
   : await createMasterProduct({
      brand_id: formData.brand_id,
      article_code: formData.article_code,
      ean_code: formData.ean_code,
      description: formData.description,
      account: formData.account,
      unit_size: formData.unit_size,
      is_active: formData.is_active,
     })

  if (!result.success) {
   errorStore.setError({
    error: result.error as Error,
    customCode: 500,
   })
   return false
  }

  // Refresh list
  await fetchMasterProducts()
  return true
 }

 // Remove master product (soft delete)
 const removeMasterProduct = async (id: string) => {
  const result = await deleteMasterProduct(id)

  if (!result.success) {
   errorStore.setError({
    error: result.error as Error,
    customCode: 500,
   })
   return false
  }

  // Refresh list
  await fetchMasterProducts()
  return true
 }

 // Reactivate master product
 const activateMasterProduct = async (id: string) => {
  const result = await reactivateMasterProduct(id)

  if (!result.success) {
   errorStore.setError({
    error: result.error as Error,
    customCode: 500,
   })
   return false
  }

  // Refresh list
  await fetchMasterProducts()
  return true
 }

 // Generate preview data for CSV upload
 // Simply formats CSV data for display - no DB query needed
 const generateCsvPreview = (
  brandId: string,
  csvRows: CsvRow[],
 ): CsvPreviewData | null => {
  // Get brand name
  const brand = brands.value?.find((b) => b.id === brandId)
  if (!brand) {
   errorStore.setError({
    error: new Error('Brand not found'),
    customCode: 404,
   })
   return null
  }

  // Map CSV rows to preview items
  const items: CsvPreviewItem[] = csvRows.map((row) => ({
   article_code: row.article_code,
   ean_code: row.ean_code,
   description: row.description,
   account: row.account,
   unit_size: row.unit_size,
  }))

  return {
   brandId,
   brandName: brand.name,
   items,
   summary: {
    total: csvRows.length,
   },
  }
 }

 // Apply upsert from CSV
 const applyCsvUpsert = async (brandId: string, products: CsvRow[]) => {
  // Reset cancel signal
  cancelSignal.value = { cancelled: false }

  const result = await upsertMasterProducts(brandId, products, {
   onProgress: (progress) => {
    uploadProgress.value = progress
   },
   signal: cancelSignal.value,
  })

  // Clear progress
  uploadProgress.value = null

  if (!result.success) {
   errorStore.setError({
    error: new Error(result.errors?.join(', ') || 'Upsert failed'),
    customCode: 500,
   })
   return null
  }

  // Refresh list - set brand filter and fetch
  selectedBrandId.value = brandId
  await fetchMasterProducts()
  return result
 }

 // Cancel ongoing upload
 const cancelUpload = () => {
  cancelSignal.value.cancelled = true
 }

 // Filter products by brand (server-side filtering)
 const filterByBrand = async (brandId: string | null) => {
  selectedBrandId.value = brandId
  await fetchMasterProducts()
 }

 // Set article code filter
 const setArticleCodeFilter = (value: string) => {
  articleCodeFilter.value = value
 }

 // Set EAN code filter
 const setEanCodeFilter = (value: string) => {
  eanCodeFilter.value = value
 }

 // Set description filter
 const setDescriptionFilter = (value: string) => {
  descriptionFilter.value = value
 }

 // Computed: active products count
 const activeProductsCount = computed(() => {
  const products = masterProducts.value as MasterProductWithBrand[] | null
  if (!products) return 0
  return products.filter((p) => p.is_active).length
 })

 // Computed: inactive products count
 const inactiveProductsCount = computed(() => {
  const products = masterProducts.value as MasterProductWithBrand[] | null
  if (!products) return 0
  return products.filter((p) => !p.is_active).length
 })

 return {
  // State
  masterProducts,
  brands,
  selectedBrandId,
  articleCodeFilter,
  eanCodeFilter,
  descriptionFilter,
  isLoading,
  uploadProgress,

  // Actions
  fetchMasterProducts,
  fetchBrands,
  saveMasterProduct,
  removeMasterProduct,
  activateMasterProduct,
  filterByBrand,
  setArticleCodeFilter,
  setEanCodeFilter,
  setDescriptionFilter,
  generateCsvPreview,
  applyCsvUpsert,
  cancelUpload,

  // Computed
  activeProductsCount,
  inactiveProductsCount,
 }
}

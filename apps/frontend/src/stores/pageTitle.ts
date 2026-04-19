import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

export const usePageTitleStore = defineStore('page-title', () => {
 const pageData = ref({
  title: '',
  breadcrumbLabel: '',
 })

 const setBreadcrumbLabel = (label: string) => {
  pageData.value.breadcrumbLabel = label
 }

 const clearBreadcumbLabel = () => {
  pageData.value.breadcrumbLabel = ''
 }

 return {
  pageData,
  setBreadcrumbLabel,
  clearBreadcumbLabel,
 }
})

// Allows edit the code and keep existing state
if (import.meta.hot) {
 import.meta.hot.accept(acceptHMRUpdate(usePageTitleStore, import.meta.hot))
}

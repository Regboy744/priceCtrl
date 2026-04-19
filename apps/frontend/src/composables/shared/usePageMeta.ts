import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePageTitleStore } from '@/stores/pageTitle'

interface Breadcrumb {
 label: string
 path: string
}

export function usePageMeta() {
 const route = useRoute()
 const pageTitleStore = usePageTitleStore()

 const breadcrumbs = computed<Breadcrumb[]>(() => {
  const paths = route.path.split('/').filter(Boolean)

  return paths.map((segment, idx) => {
   // Check if this is the last segment and we have a custom label
   const isLastSegment = idx === paths.length - 1
   const customLabel = isLastSegment
    ? pageTitleStore.pageData.breadcrumbLabel
    : ''

   return {
    label: customLabel || segment.charAt(0).toUpperCase() + segment.slice(1),
    path: '/' + paths.slice(0, idx + 1).join('/'),
   }
  })
 })

 const title = computed(
  () => route.meta.title || breadcrumbs.value.at(-1)?.label || 'Dashboard',
 )

 return { breadcrumbs, title }
}

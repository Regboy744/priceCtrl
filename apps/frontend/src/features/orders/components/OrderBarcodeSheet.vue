<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
 Sheet,
 SheetContent,
 SheetDescription,
 SheetHeader,
 SheetTitle,
} from '@/components/ui/sheet'
import { Barcode, Printer } from 'lucide-vue-next'
import type { OrderDetail } from '@/features/orders/types'
import {
 type BarcodeRenderOptions,
 renderBarcodeToSvg,
 resolveBarcodeFormat,
} from '@/features/orders/utils/barcode'

interface Props {
 open: boolean
 order: OrderDetail | null
 isLoading?: boolean
 error?: string | null
}

interface Emits {
 (e: 'update:open', value: boolean): void
}

interface BarcodeLineItem {
 id: string
 lineNumber: number
 articleCode: string
 description: string
 quantity: number
 supplierName: string | null
}

type DensityMode = 'standard' | 'compact'

interface PrintProfile {
 columns: number
 gapPx: number
 cardPaddingPx: number
 barcodePaddingPx: number
 pageMarginMm: number
 articleFontPx: number
 descriptionFontPx: number
 quantityFontPx: number
 supplierFontPx: number
}

const props = withDefaults(defineProps<Props>(), {
 isLoading: false,
 error: null,
})

const emit = defineEmits<Emits>()

const LONG_CODE_THRESHOLD = 14

const containerRef = ref<HTMLElement | null>(null)
const renderError = ref<string | null>(null)
const densityMode = ref<DensityMode>('compact')

const barcodeItems = computed<BarcodeLineItem[]>(() => {
 const items = props.order?.order_items ?? []

 return items
  .map((item, index) => ({
   id: item.id,
   lineNumber: index + 1,
   articleCode: item.master_products?.article_code ?? '',
   description: item.master_products?.description ?? 'No description',
   quantity: item.quantity,
   supplierName: item.supplier_products?.suppliers?.name ?? null,
  }))
  .filter((item) => item.articleCode.trim().length > 0)
})

const compactModeActive = computed(() => densityMode.value === 'compact')

const printProfile = computed<PrintProfile>(() => {
 if (compactModeActive.value) {
  return {
   columns: 3,
   gapPx: 8,
   cardPaddingPx: 8,
   barcodePaddingPx: 6,
   pageMarginMm: 8,
   articleFontPx: 12,
   descriptionFontPx: 10,
   quantityFontPx: 10,
   supplierFontPx: 9,
  }
 }

 return {
  columns: 2,
  gapPx: 12,
  cardPaddingPx: 12,
  barcodePaddingPx: 8,
  pageMarginMm: 12,
  articleFontPx: 14,
  descriptionFontPx: 12,
  quantityFontPx: 12,
  supplierFontPx: 11,
 }
})

const gridClass = computed(() => {
 if (compactModeActive.value) {
  return 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'
 }

 return 'grid grid-cols-1 gap-4 md:grid-cols-2'
})

const renderSignature = computed(() => {
 return barcodeItems.value
  .map((item) => `${item.id}:${item.articleCode}:${item.quantity}`)
  .join('|')
})

const isLongBarcodeValue = (value: string): boolean => {
 const compactValue = value.replace(/\s+/g, '')
 return compactValue.length > LONG_CODE_THRESHOLD
}

const getRenderOptions = (item: BarcodeLineItem): BarcodeRenderOptions => {
 const format = resolveBarcodeFormat(item.articleCode)

 if (compactModeActive.value && !isLongBarcodeValue(item.articleCode)) {
  return {
   format,
   width: 1.7,
   height: 58,
   fontSize: 11,
   textMargin: 2,
   margin: 4,
  }
 }

 return {
  format,
  width: 2,
  height: 78,
  fontSize: 14,
  textMargin: 3,
  margin: 6,
 }
}

const getCardClasses = (item: BarcodeLineItem): string[] => {
 const classes = ['rounded-lg', 'border', 'bg-card']

 if (compactModeActive.value) {
  classes.push('p-3')
 } else {
  classes.push('p-4')
 }

 if (compactModeActive.value && isLongBarcodeValue(item.articleCode)) {
  classes.push('md:col-span-2', 'xl:col-span-2')
 }

 return classes
}

const getBarcodeWrapperClasses = (item: BarcodeLineItem): string[] => {
 const classes = ['mt-3', 'rounded-md', 'border', 'bg-white']

 if (compactModeActive.value && !isLongBarcodeValue(item.articleCode)) {
  classes.push('p-2')
 } else {
  classes.push('p-3')
 }

 return classes
}

const getSvgClasses = (item: BarcodeLineItem): string => {
 if (compactModeActive.value && !isLongBarcodeValue(item.articleCode)) {
  return 'h-[84px] w-full'
 }

 return 'h-[110px] w-full'
}

const getSvgElement = (itemId: string): SVGSVGElement | null => {
 if (!containerRef.value) return null

 const element = containerRef.value.querySelector(
  `svg[data-barcode-id="${itemId}"]`,
 )

 return element instanceof SVGSVGElement ? element : null
}

const renderAllBarcodes = () => {
 renderError.value = null

 for (const item of barcodeItems.value) {
  const svg = getSvgElement(item.id)
  if (!svg) continue

  try {
   renderBarcodeToSvg(svg, item.articleCode, getRenderOptions(item))
  } catch (error) {
   renderError.value =
    error instanceof Error
     ? error.message
     : `Failed to render barcode for ${item.articleCode}`
  }
 }
}

const escapeHtml = (value: string): string => {
 return value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')
}

const printLabels = () => {
 if (!barcodeItems.value.length) return

 const profile = printProfile.value
 const longCodeRule = compactModeActive.value
  ? '.label-card.long-code { grid-column: span 2; }'
  : ''

 const labelMarkup = barcodeItems.value
  .map((item) => {
   const svg = getSvgElement(item.id)
   if (!svg) return ''

   const longCodeClass = isLongBarcodeValue(item.articleCode)
    ? ' long-code'
    : ''

   return `
<article class="label-card${longCodeClass}">
  <header class="label-header">
    <div>
      <p class="article-code">${escapeHtml(item.articleCode)}</p>
      <p class="description">${escapeHtml(item.description)}</p>
    </div>
    <div class="quantity">Qty: ${item.quantity}</div>
  </header>
  <div class="barcode-wrapper">${svg.outerHTML}</div>
  <footer class="supplier">${escapeHtml(item.supplierName ?? '')}</footer>
</article>
`
  })
  .join('')

 if (!labelMarkup) return

 const printWindow = window.open(
  '',
  '_blank',
  'noopener,noreferrer,width=1200,height=900',
 )

 if (!printWindow) {
  renderError.value =
   'Could not open print window. Please allow pop-ups and try again.'
  return
 }

 printWindow.document.write(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Order Barcode Labels</title>
    <style>
      body {
        margin: 0;
        padding: 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #111827;
        background: #ffffff;
      }
      .label-grid {
        display: grid;
        grid-template-columns: repeat(${profile.columns}, minmax(0, 1fr));
        gap: ${profile.gapPx}px;
      }
      .label-card {
        border: 1px solid #d4d4d8;
        border-radius: 8px;
        padding: ${profile.cardPaddingPx}px;
        break-inside: avoid;
      }
      ${longCodeRule}
      .label-header {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .article-code {
        margin: 0;
        font-size: ${profile.articleFontPx}px;
        font-weight: 700;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          'Liberation Mono', 'Courier New', monospace;
      }
      .description {
        margin: 3px 0 0;
        font-size: ${profile.descriptionFontPx}px;
        color: #6b7280;
      }
      .quantity {
        font-size: ${profile.quantityFontPx}px;
        font-weight: 600;
        white-space: nowrap;
      }
      .barcode-wrapper {
        margin-top: 6px;
        border: 1px solid #e4e4e7;
        border-radius: 6px;
        padding: ${profile.barcodePaddingPx}px;
      }
      .barcode-wrapper svg {
        width: 100%;
        height: auto;
        display: block;
      }
      .supplier {
        margin-top: 6px;
        min-height: 14px;
        font-size: ${profile.supplierFontPx}px;
        color: #6b7280;
      }
      @page {
        size: A4;
        margin: ${profile.pageMarginMm}mm;
      }
      @media print {
        body {
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <section class="label-grid">
      ${labelMarkup}
    </section>
  </body>
</html>
`)

 printWindow.document.close()
 printWindow.focus()
 printWindow.onload = () => {
  printWindow.print()
 }
}

watch(
 [() => props.open, () => props.isLoading, renderSignature, densityMode],
 async ([isOpen, isLoading]) => {
  if (!isOpen || isLoading) return

  await nextTick()
  renderAllBarcodes()
 },
 { immediate: true },
)

watch(
 () => props.open,
 (isOpen) => {
  if (!isOpen) {
   renderError.value = null
  }
 },
)
</script>

<template>
 <Sheet :open="open" @update:open="(value) => emit('update:open', value)">
  <SheetContent class="sm:max-w-[920px] overflow-y-auto p-4">
   <SheetHeader>
    <SheetTitle class="flex items-center gap-2">
     <Barcode class="h-5 w-5" />
     Order Barcodes
    </SheetTitle>
    <SheetDescription>
     Scan-ready labels from persisted order lines. Compact mode is optimized for
     A4 print sheets.
    </SheetDescription>
   </SheetHeader>

   <div class="mt-6 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
     <div class="flex flex-wrap items-center gap-3">
      <Badge variant="secondary">{{ barcodeItems.length }} labels</Badge>

      <div class="flex items-center gap-1 rounded-md border bg-muted/30 p-1">
       <Button
        size="sm"
        class="h-7"
        :variant="compactModeActive ? 'default' : 'ghost'"
        @click="densityMode = 'compact'"
       >
        Compact (A4)
       </Button>
       <Button
        size="sm"
        class="h-7"
        :variant="compactModeActive ? 'ghost' : 'default'"
        @click="densityMode = 'standard'"
       >
        Standard
       </Button>
      </div>
     </div>

     <Button
      variant="outline"
      size="sm"
      :disabled="isLoading || barcodeItems.length === 0"
      @click="printLabels"
     >
      <Printer class="mr-2 h-4 w-4" />
      Print / Save PDF
     </Button>
    </div>

    <div
     v-if="error"
     class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
    >
     {{ error }}
    </div>

    <div
     v-if="renderError"
     class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
    >
     {{ renderError }}
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-14">
     <div
      class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
     />
    </div>

    <div
     v-else-if="barcodeItems.length === 0"
     class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
    >
     No barcode labels are available for this order.
    </div>

    <div v-else ref="containerRef" :class="gridClass">
     <article
      v-for="item in barcodeItems"
      :key="item.id"
      :class="getCardClasses(item)"
     >
      <header class="flex items-start justify-between gap-2">
       <div class="min-w-0">
        <p
         :class="[
          'font-mono font-semibold',
          compactModeActive ? 'text-xs' : 'text-sm',
         ]"
        >
         {{ item.articleCode }}
        </p>
        <p
         :class="[
          'truncate text-muted-foreground',
          compactModeActive ? 'text-[11px]' : 'text-xs',
         ]"
        >
         {{ item.description }}
        </p>
       </div>
       <div class="shrink-0 text-right">
        <p
         :class="[
          'text-muted-foreground',
          compactModeActive ? 'text-[10px]' : 'text-xs',
         ]"
        >
         Qty
        </p>
        <p
         :class="['font-semibold', compactModeActive ? 'text-xs' : 'text-sm']"
        >
         {{ item.quantity }}
        </p>
       </div>
      </header>

      <div :class="getBarcodeWrapperClasses(item)">
       <svg :data-barcode-id="item.id" :class="getSvgClasses(item)" />
      </div>

      <footer class="mt-3">
       <p
        :class="[
         'truncate text-muted-foreground pr-1',
         compactModeActive ? 'text-[11px]' : 'text-xs',
        ]"
       >
        {{ item.supplierName || 'Supplier unavailable' }}
       </p>
      </footer>
     </article>
    </div>
   </div>
  </SheetContent>
 </Sheet>
</template>

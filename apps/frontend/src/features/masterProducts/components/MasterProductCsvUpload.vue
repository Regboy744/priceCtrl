<script setup lang="ts">
import { ref, computed } from 'vue'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { SheetClose } from '@/components/ui/sheet'
import {
 Select,
 SelectContent,
 SelectGroup,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select'
import {
 Upload,
 FileSpreadsheet,
 AlertCircle,
 CheckCircle2,
} from 'lucide-vue-next'
import { validateCsvRows } from '@/features/masterProducts/schemas/masterProductSchemas'
import type {
 BrandOption,
 CsvRow,
 CsvPreviewData,
} from '@/features/masterProducts/types'

interface Props {
 brands: BrandOption[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
 preview: [data: { brandId: string; rows: CsvRow[] }]
 apply: [data: { brandId: string; rows: CsvRow[] }]
}>()

// State
const selectedBrandId = ref<string>('')
const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref<string>('')
const parsedRows = ref<CsvRow[]>([])
const parseErrors = ref<{ row: number; field: string; message: string }[]>([])
const isParsing = ref(false)
const step = ref<'upload' | 'preview'>('upload')
const previewData = ref<CsvPreviewData | null>(null)

// Computed
const canProceed = computed(() => {
 return (
  selectedBrandId.value &&
  parsedRows.value.length > 0 &&
  parseErrors.value.length === 0
 )
})

// Methods
const handleFileSelect = () => {
 fileInput.value?.click()
}

const handleFileChange = (event: Event) => {
 const target = event.target as HTMLInputElement
 const file = target.files?.[0]

 if (!file) return

 fileName.value = file.name
 isParsing.value = true
 parseErrors.value = []
 parsedRows.value = []

 Papa.parse(file, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
   isParsing.value = false

   // Validate rows
   const { validRows, errors } = validateCsvRows(results.data)

   parsedRows.value = validRows
   parseErrors.value = errors

   if (errors.length === 0 && validRows.length > 0) {
    // Auto-proceed to preview
   }
  },
  error: (error) => {
   isParsing.value = false
   parseErrors.value = [
    {
     row: 0,
     field: 'file',
     message: `Failed to parse CSV: ${error.message}`,
    },
   ]
  },
 })
}

const handleProceedToPreview = () => {
 if (!canProceed.value) return

 emit('preview', {
  brandId: selectedBrandId.value,
  rows: parsedRows.value,
 })
}

const resetForm = () => {
 selectedBrandId.value = ''
 fileName.value = ''
 parsedRows.value = []
 parseErrors.value = []
 step.value = 'upload'
 previewData.value = null
 if (fileInput.value) {
  fileInput.value.value = ''
 }
}
</script>

<template>
 <div class="space-y-6 px-4">
  <!-- Brand Selection -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     1. Select Brand
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50">
    <div class="flex flex-col gap-2">
     <label class="text-sm font-medium">Brand</label>
     <Select v-model="selectedBrandId">
      <SelectTrigger class="w-full">
       <SelectValue placeholder="Select brand for upload" />
      </SelectTrigger>
      <SelectContent>
       <SelectGroup>
        <SelectItem
         v-for="brand in props.brands"
         :key="brand.id"
         :value="brand.id"
        >
         {{ brand.name }}
        </SelectItem>
       </SelectGroup>
      </SelectContent>
     </Select>
     <p class="text-xs text-muted-foreground">
      All products in the CSV will be assigned to this brand
     </p>
    </div>
   </div>
  </div>

  <!-- File Upload -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     2. Upload CSV File
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50">
    <input
     ref="fileInput"
     type="file"
     accept=".csv"
     class="hidden"
     @change="handleFileChange"
    />

    <div
     class="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
     :class="{ 'border-primary': fileName }"
     @click="handleFileSelect"
    >
     <div v-if="!fileName" class="space-y-2">
      <Upload class="w-10 h-10 mx-auto text-muted-foreground" />
      <p class="text-sm font-medium">Click to upload CSV file</p>
      <p class="text-xs text-muted-foreground">
       Required columns: article_code, ean_code, description
      </p>
      <p class="text-xs text-muted-foreground">
       Optional columns: account, unit_size
      </p>
     </div>
     <div v-else class="space-y-2">
      <FileSpreadsheet class="w-10 h-10 mx-auto text-primary" />
      <p class="text-sm font-medium">{{ fileName }}</p>
      <p class="text-xs text-muted-foreground">
       Click to select a different file
      </p>
     </div>
    </div>

    <!-- Parse Status -->
    <div v-if="isParsing" class="text-center text-sm text-muted-foreground">
     Parsing CSV file...
    </div>

    <!-- Parse Success -->
    <div
     v-if="parsedRows.length > 0 && parseErrors.length === 0"
     class="flex items-start gap-3 p-4 rounded-lg border border-green-500/50 bg-green-500/10"
    >
     <CheckCircle2 class="h-5 w-5 text-green-500 mt-0.5" />
     <div>
      <p class="font-medium text-green-500">CSV Parsed Successfully</p>
      <p class="text-sm text-muted-foreground">
       Found {{ parsedRows.length }} valid product(s) ready for import
      </p>
     </div>
    </div>

    <!-- Parse Errors -->
    <div
     v-if="parseErrors.length > 0"
     class="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10"
    >
     <AlertCircle class="h-5 w-5 text-destructive mt-0.5" />
     <div class="flex-1">
      <p class="font-medium text-destructive">Validation Errors</p>
      <p class="text-sm text-muted-foreground mb-2">
       Found {{ parseErrors.length }} error(s) in the CSV file:
      </p>
      <ul
       class="list-disc list-inside text-xs space-y-1 max-h-32 overflow-y-auto"
      >
       <li v-for="(error, index) in parseErrors.slice(0, 10)" :key="index">
        Row {{ error.row }}: {{ error.field }} - {{ error.message }}
       </li>
       <li v-if="parseErrors.length > 10" class="text-muted-foreground">
        ... and {{ parseErrors.length - 10 }} more errors
       </li>
      </ul>
     </div>
    </div>
   </div>
  </div>

  <!-- CSV Format Help -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     CSV Format
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="bg-muted/30 p-4 rounded-lg border border-border/50">
    <p class="text-xs text-muted-foreground mb-2">Example CSV format:</p>
    <pre class="text-xs bg-background p-2 rounded overflow-x-auto">
article_code,ean_code,description,account,unit_size
1234567890,5901234123457,Fresh Milk 1L,DAIRY_PRODUCTS,1L
9876543210,5901234567890,White Bread,BAKERY_ITEMS,800g</pre
    >
   </div>
  </div>

  <!-- Submit Actions -->
  <div
   class="sticky bottom-0 pt-6 pb-6 -mx-4 px-4 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-t"
  >
   <div class="flex flex-col-reverse sm:flex-row sm:justify-center gap-3">
    <SheetClose as-child>
     <Button
      variant="outline"
      type="button"
      class="w-full sm:w-35"
      @click="resetForm"
     >
      Cancel
     </Button>
    </SheetClose>
    <Button
     type="button"
     class="w-full sm:w-35"
     :disabled="!canProceed"
     @click="handleProceedToPreview"
    >
     Preview Changes
    </Button>
   </div>
  </div>
 </div>
</template>

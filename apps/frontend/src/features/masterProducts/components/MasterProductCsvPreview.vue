<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { SheetClose } from '@/components/ui/sheet'
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table'
import { Loader2, X } from 'lucide-vue-next'
import type {
 CsvPreviewData,
 UpsertProgress,
} from '@/features/masterProducts/types'

interface Props {
 previewData: CsvPreviewData
 isApplying?: boolean
 uploadProgress?: UpsertProgress | null
}

defineProps<Props>()

const emit = defineEmits<{
 apply: []
 back: []
 cancel: []
}>()
</script>

<template>
 <div class="space-y-6 px-4">
  <!-- Summary -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     Import Preview for {{ previewData.brandName }}
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>

   <div class="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
    <p class="text-3xl font-bold">{{ previewData.summary.total }}</p>
    <p class="text-sm text-muted-foreground">Products to import</p>
   </div>
  </div>

  <!-- Preview Table -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     CSV Preview
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>

   <div class="bg-muted/30 rounded-lg border border-border/50 overflow-hidden">
    <div class="max-h-96 overflow-y-auto">
     <Table>
      <TableHeader>
       <TableRow>
        <TableHead>Article Code</TableHead>
        <TableHead>EAN Code</TableHead>
        <TableHead>Description</TableHead>
       </TableRow>
      </TableHeader>
      <TableBody>
       <TableRow
        v-for="(item, index) in previewData.items.slice(0, 100)"
        :key="index"
       >
        <TableCell class="font-mono text-xs">{{ item.article_code }}</TableCell>
        <TableCell class="font-mono text-xs">{{ item.ean_code }}</TableCell>
        <TableCell class="max-w-48 truncate">{{ item.description }}</TableCell>
       </TableRow>
      </TableBody>
     </Table>
    </div>

    <div
     v-if="previewData.items.length > 100"
     class="p-3 text-center text-sm text-muted-foreground border-t"
    >
     Showing first 100 of {{ previewData.items.length }} items
    </div>
   </div>
  </div>

  <!-- Upload Progress -->
  <div
   v-if="uploadProgress"
   class="bg-primary/10 p-4 rounded-lg border border-primary/30 space-y-3"
  >
   <div class="flex items-center justify-between">
    <div>
     <p class="text-sm font-medium text-primary">
      {{ uploadProgress.message }}
     </p>
     <p class="text-xs text-muted-foreground mt-1">
      {{ uploadProgress.current }} / {{ uploadProgress.total }}
      <span v-if="uploadProgress.total > 0">
       ({{
        Math.round((uploadProgress.current / uploadProgress.total) * 100)
       }}%)
      </span>
     </p>
    </div>
    <Button
     variant="ghost"
     size="sm"
     class="text-destructive hover:text-destructive"
     @click="emit('cancel')"
    >
     <X class="h-4 w-4" />
    </Button>
   </div>

   <!-- Progress Bar -->
   <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
    <div
     class="bg-primary h-full transition-all duration-300 ease-out"
     :style="{
      width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
     }"
    ></div>
   </div>

   <!-- Phase indicator -->
   <div class="flex items-center gap-2 text-xs text-muted-foreground">
    <span
     class="px-2 py-1 rounded-md"
     :class="{
      'bg-success/20 text-success':
       uploadProgress.phase === 'fetching' ||
       uploadProgress.phase === 'complete',
      'bg-primary/20 text-primary': uploadProgress.phase === 'processing',
      'bg-chart-4/20 text-chart-4': uploadProgress.phase === 'inserting',
     }"
    >
     {{ uploadProgress.phase.toUpperCase() }}
    </span>
   </div>
  </div>

  <!-- Submit Actions -->
  <div
   class="sticky bottom-0 pt-6 pb-6 -mx-4 px-4 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-t"
  >
   <div class="flex flex-col-reverse sm:flex-row sm:justify-center gap-3">
    <Button
     variant="outline"
     type="button"
     class="w-full sm:w-35"
     :disabled="isApplying || !!uploadProgress"
     @click="emit('back')"
    >
     Back
    </Button>
    <SheetClose v-if="!uploadProgress" as-child>
     <Button
      type="button"
      class="w-full sm:w-45"
      :disabled="
       isApplying || !!uploadProgress || previewData.summary.total === 0
      "
      @click="emit('apply')"
     >
      <Loader2 v-if="isApplying" class="mr-2 h-4 w-4 animate-spin" />
      {{
       isApplying
        ? 'Importing...'
        : `Import ${previewData.summary.total} Products`
      }}
     </Button>
    </SheetClose>
    <Button
     v-else
     variant="destructive"
     type="button"
     class="w-full sm:w-45"
     @click="emit('cancel')"
    >
     <X class="mr-2 h-4 w-4" />
     Cancel Upload
    </Button>
   </div>
  </div>
 </div>
</template>

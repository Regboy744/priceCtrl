<script setup lang="ts">
import { TriangleAlertIcon } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'

defineProps<{
 message: string
 customCode: number
 details: string
 code: string
 hint: string | null
 statusCode: number
}>()
</script>

<template>
 <div>
  <TriangleAlertIcon
   icon="lucide:triangle-alert"
   class="mx-auto text-destructive size-16"
  />
  <h1 class="my-2 text-7xl font-extrabold text-secondary">
   {{ customCode || code }}
  </h1>
  <p class="my-2 text-7xl font-extrabold text-secondary" v-if="statusCode">
   Status Code:{{ statusCode }}
  </p>
  <p class="my-2 text-3xl font-extrabold text-primary">{{ message }}</p>
  <p v-if="hint">{{ hint }}</p>
  <p v-if="details">{{ details }}</p>

  <div class="mt-6 flex flex-col items-center justify-center gap-5 font-light">
   <p class="text-lg text-muted-foreground">
    You'll find lots to explore on the home page.
   </p>
   <RouterLink to="/">
    <Button class="max-w-36"> Back to homepage </Button>
   </RouterLink>
  </div>
 </div>
</template>

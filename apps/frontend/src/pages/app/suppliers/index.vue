<script setup lang="ts">
definePage({
 meta: {
  allowedRoles: ['master'],
 },
})

import { apiClient } from '@/lib/apiClient'
import { ref } from 'vue'
import type { Tables } from '@/types/shared/database.types'

const suppliers = ref<Tables<'suppliers'>[] | null>(null)

;(async () => {
 const res = await apiClient.get<Tables<'suppliers'>[]>('/suppliers')

 if (!res.success) {
  console.log(res.error)
  return
 }

 suppliers.value = res.data ?? []
})()
</script>

<template>
 <div>
  <h1>suppliers</h1>
  <ul>
   <li v-for="supplier in suppliers" :key="supplier.id">
    {{ supplier.name }}
   </li>
  </ul>
 </div>
</template>

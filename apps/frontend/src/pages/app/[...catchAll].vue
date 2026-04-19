<script setup lang="ts">
import { useErrorStore } from '@/stores/error'

// It sets the activeError to true
useErrorStore().setError({ error: 'Page not found man', customCode: 404 })
</script>

<template>
 <div></div>
</template>

<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner'
</script>

<template>
 <RouterView />
 <Toaster position="bottom-right" :duration="5000" rich-colors />
</template>

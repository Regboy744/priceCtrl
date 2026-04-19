<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Sun, Moon } from 'lucide-vue-next'
import { useTheme } from '@/composables/shared/useTheme'

const { isDark, toggleTheme } = useTheme()
</script>

<template>
 <Button
  variant="ghost"
  size="icon"
  @click="toggleTheme"
  aria-label="Toggle theme"
 >
  <Sun v-if="isDark" class="h-5 w-5" />
  <Moon v-else class="h-5 w-5" />
 </Button>
</template>

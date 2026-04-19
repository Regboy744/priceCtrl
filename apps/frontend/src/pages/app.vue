<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Indexlayout from '@/components/app-layout/Indexlayout.vue'
import { useAuthStore } from '@/stores/auth'
import { Loader2 } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

// Loading state while checking auth
const isCheckingAuth = ref(true)

// Check if user is authenticated
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isInitialized = computed(() => authStore.isInitialized)

// Activity tracking interval
let activityInterval: ReturnType<typeof setInterval> | null = null

// Check auth status and handle redirects
onMounted(async () => {
 // Wait for auth to initialize if not already
 if (!isInitialized.value) {
  await authStore.initSession()
 }

 isCheckingAuth.value = false

 // If not authenticated after initialization, redirect to login
 if (!isAuthenticated.value) {
  router.push('/auth/login')
  return
 }

 // Set up activity tracking (check every 5 minutes)
 activityInterval = setInterval(
  () => {
   if (authStore.checkInactivityTimeout()) {
    // Session timed out
    authStore.signOut()
    router.push({
     path: '/auth/login',
     query: { reason: 'session-timeout' },
    })
   }
  },
  5 * 60 * 1000,
 ) // 5 minutes

 // Track user activity on various events
 const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll']

 const handleActivity = () => {
  authStore.updateLastActivity()
 }

 activityEvents.forEach((event) => {
  document.addEventListener(event, handleActivity, { passive: true })
 })

 // Store cleanup function
 onUnmounted(() => {
  if (activityInterval) {
   clearInterval(activityInterval)
  }
  activityEvents.forEach((event) => {
   document.removeEventListener(event, handleActivity)
  })
 })
})
</script>

<template>
 <!-- Loading State -->
 <div
  v-if="isCheckingAuth || !isInitialized"
  class="min-h-screen flex items-center justify-center bg-background"
 >
  <div class="flex flex-col items-center space-y-4">
   <Loader2 class="w-8 h-8 text-primary animate-spin" />
   <p class="text-muted-foreground text-sm">Loading...</p>
  </div>
 </div>

 <!-- Main App Layout -->
 <Indexlayout v-else-if="isAuthenticated">
  <RouterView v-slot="{ Component, route }">
   <Suspense v-if="Component" timeout="0">
    <Component :is="Component" :key="route.name"></Component>

    <template #fallback>
     <div class="flex items-center justify-center min-h-[200px]">
      <Loader2 class="w-6 h-6 text-primary animate-spin" />
     </div>
    </template>
   </Suspense>
  </RouterView>
 </Indexlayout>

 <!-- Not authenticated - will redirect -->
 <div
  v-else
  class="min-h-screen flex items-center justify-center bg-background"
 >
  <div class="flex flex-col items-center space-y-4">
   <Loader2 class="w-8 h-8 text-primary animate-spin" />
   <p class="text-muted-foreground text-sm">Redirecting to login...</p>
  </div>
 </div>
</template>

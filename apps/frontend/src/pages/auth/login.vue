<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
 AlertCircle,
 Eye,
 EyeOff,
 Loader2,
 Tag,
 Lock,
 Mail,
} from 'lucide-vue-next'

const route = useRoute()
const {
 isLoading,
 error,
 validationErrors,
 signIn,
 clearValidationErrors,
 sanitizeErrorMessage,
 isRateLimited,
 getBackoffDelay,
} = useAuth()

// Form state
const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const showPassword = ref(false)
const localError = ref<string | null>(null)

// Get redirect URL from query params
const redirectUrl = computed(() => {
 const redirect = route.query.redirect as string
 // Validate redirect URL to prevent open redirect attacks
 if (redirect && redirect.startsWith('/')) {
  return redirect
 }
 return '/app'
})

// Success message from query params (e.g., after password reset)
const successMessage = computed(() => {
 const message = route.query.message as string
 if (message === 'password-updated') {
  return 'Your password has been updated. Please sign in with your new password.'
 }
 return null
})

// Combined error message
const displayError = computed(() => {
 if (localError.value) return localError.value
 if (error.value) return sanitizeErrorMessage(error.value)
 return null
})

// Backoff countdown
const backoffSeconds = ref(0)
let backoffInterval: ReturnType<typeof setInterval> | null = null

const updateBackoffCountdown = () => {
 const delay = getBackoffDelay()
 if (delay > 0) {
  backoffSeconds.value = Math.ceil(delay / 1000)
  if (!backoffInterval) {
   backoffInterval = setInterval(() => {
    const newDelay = getBackoffDelay()
    if (newDelay > 0) {
     backoffSeconds.value = Math.ceil(newDelay / 1000)
    } else {
     backoffSeconds.value = 0
     if (backoffInterval) {
      clearInterval(backoffInterval)
      backoffInterval = null
     }
    }
   }, 1000)
  }
 }
}

// Handle form submission
const handleSubmit = async () => {
 localError.value = null
 clearValidationErrors()

 const result = await signIn(
  email.value,
  password.value,
  rememberMe.value,
  redirectUrl.value,
 )

 if (!result.success && result.error) {
  localError.value = result.error
  updateBackoffCountdown()
 }
}

// Toggle password visibility
const togglePasswordVisibility = () => {
 showPassword.value = !showPassword.value
}

// Clear error when user starts typing
const handleInputChange = () => {
 if (localError.value) {
  localError.value = null
 }
 clearValidationErrors()
}

// Check if form is valid for submission
const isFormValid = computed(() => {
 return email.value.trim().length > 0 && password.value.length >= 8
})

// Disable submit button
const isSubmitDisabled = computed(() => {
 return isLoading.value || !isFormValid.value || isRateLimited.value
})

onMounted(() => {
 // Focus email input on mount
 const emailInput = document.getElementById('email')
 if (emailInput) {
  emailInput.focus()
 }
})

onUnmounted(() => {
 if (backoffInterval) {
  clearInterval(backoffInterval)
  backoffInterval = null
 }
})
</script>

<template>
 <div
  class="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background px-4 py-12"
 >
  <!-- Background decorations -->
  <div class="absolute inset-0 overflow-hidden">
   <div
    class="absolute top-20 left-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl"
   ></div>
   <div
    class="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
   ></div>
  </div>

  <Card
   class="w-full max-w-md backdrop-blur-lg bg-card/50 border-border relative z-10"
  >
   <CardHeader class="space-y-4 text-center pb-2">
    <!-- Logo/Brand -->
    <div class="flex justify-center">
     <div class="p-3 bg-primary/10 rounded-xl border border-primary/20">
      <Tag class="w-8 h-8 text-primary" />
     </div>
    </div>

    <div class="space-y-2">
     <CardTitle class="text-2xl font-bold text-foreground">
      Welcome back
     </CardTitle>
     <p class="text-muted-foreground text-sm">
      Sign in to your Price Ctrl account
     </p>
    </div>
   </CardHeader>

   <CardContent class="space-y-6 pt-4">
    <!-- Success Message -->
    <div
     v-if="successMessage"
     class="flex items-start gap-3 p-3 rounded-lg bg-success/10 border border-success/20"
    >
     <div class="text-sm text-success">
      {{ successMessage }}
     </div>
    </div>

    <!-- Error Message -->
    <div
     v-if="displayError"
     class="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
    >
     <AlertCircle class="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
     <div class="text-sm text-destructive">
      {{ displayError }}
      <span v-if="backoffSeconds > 0" class="block mt-1">
       Please wait {{ backoffSeconds }} second{{
        backoffSeconds !== 1 ? 's' : ''
       }}
       before trying again.
      </span>
     </div>
    </div>

    <!-- Login Form -->
    <form @submit.prevent="handleSubmit" class="space-y-4">
     <!-- Email Field -->
     <div class="space-y-2">
      <Label for="email" class="text-foreground/80">Email</Label>
      <div class="relative">
       <Mail
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
       />
       <Input
        id="email"
        v-model="email"
        type="email"
        placeholder="you@example.com"
        autocomplete="email"
        :disabled="isLoading"
        :aria-invalid="!!validationErrors.email"
        class="pl-10 bg-card/50 border-border text-foreground placeholder:text-muted-foreground focus:border-ring"
        @input="handleInputChange"
       />
      </div>
      <p v-if="validationErrors.email" class="text-sm text-destructive">
       {{ validationErrors.email }}
      </p>
     </div>

     <!-- Password Field -->
     <div class="space-y-2">
      <div class="flex items-center justify-between">
       <Label for="password" class="text-foreground/80">Password</Label>
       <RouterLink
        to="/auth/forgot-password"
        class="text-sm text-primary hover:text-primary/80 transition-colors"
       >
        Forgot password?
       </RouterLink>
      </div>
      <div class="relative">
       <Lock
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
       />
       <Input
        id="password"
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        placeholder="Enter your password"
        autocomplete="current-password"
        :disabled="isLoading"
        :aria-invalid="!!validationErrors.password"
        class="pl-10 pr-10 bg-card/50 border-border text-foreground placeholder:text-muted-foreground focus:border-ring"
        @input="handleInputChange"
       />
       <button
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80 transition-colors"
        @click="togglePasswordVisibility"
        :aria-label="showPassword ? 'Hide password' : 'Show password'"
       >
        <EyeOff v-if="showPassword" class="w-4 h-4" />
        <Eye v-else class="w-4 h-4" />
       </button>
      </div>
      <p v-if="validationErrors.password" class="text-sm text-destructive">
       {{ validationErrors.password }}
      </p>
     </div>

     <!-- Remember Me -->
     <div class="flex items-center gap-2">
      <Checkbox
       id="remember"
       v-model:checked="rememberMe"
       :disabled="isLoading"
       class="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      />
      <Label
       for="remember"
       class="text-sm text-muted-foreground cursor-pointer select-none"
      >
       Remember me for 30 days
      </Label>
     </div>

     <!-- Submit Button -->
     <Button
      type="submit"
      class="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      :disabled="isSubmitDisabled"
     >
      <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
      {{ isLoading ? 'Signing in...' : 'Sign in' }}
     </Button>
    </form>

    <!-- Footer -->
    <div class="text-center pt-4 border-t border-border">
     <p class="text-sm text-muted-foreground">
      Need help? Contact your administrator
     </p>
    </div>
   </CardContent>
  </Card>
 </div>
</template>

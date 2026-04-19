<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/auth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
 AlertCircle,
 ArrowLeft,
 CheckCircle2,
 Eye,
 EyeOff,
 Loader2,
 Lock,
 ShoppingCart,
} from 'lucide-vue-next'

const router = useRouter()
const {
 isLoading,
 validationErrors,
 updatePassword,
 clearValidationErrors,
 sanitizeErrorMessage,
 validatePassword,
 validateConfirmPassword,
} = useAuth()

// Page state
const pageStatus = ref<'loading' | 'ready' | 'success' | 'error'>('loading')
const pageError = ref<string | null>(null)

// Form state
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const localError = ref<string | null>(null)

// Password strength indicator
const passwordStrength = computed(() => {
 const pwd = password.value
 if (!pwd) return { level: 0, text: '', color: '' }

 let score = 0

 // Length
 if (pwd.length >= 8) score++
 if (pwd.length >= 12) score++

 // Complexity
 if (/[a-z]/.test(pwd)) score++
 if (/[A-Z]/.test(pwd)) score++
 if (/[0-9]/.test(pwd)) score++
 if (/[^a-zA-Z0-9]/.test(pwd)) score++

 if (score <= 2) return { level: 1, text: 'Weak', color: 'bg-destructive' }
 if (score <= 4) return { level: 2, text: 'Fair', color: 'bg-warning' }
 if (score <= 5) return { level: 3, text: 'Good', color: 'bg-primary' }
 return { level: 4, text: 'Strong', color: 'bg-success' }
})

// Combined error message
const displayError = computed(() => {
 if (localError.value) return sanitizeErrorMessage(localError.value)
 if (validationErrors.value.password) return validationErrors.value.password
 if (validationErrors.value.confirmPassword)
  return validationErrors.value.confirmPassword
 return null
})

// Check if form is valid
const isFormValid = computed(() => {
 return (
  password.value.length >= 8 &&
  password.value === confirmPassword.value &&
  !validatePassword(password.value) &&
  !validateConfirmPassword(password.value, confirmPassword.value)
 )
})

// Verify session on mount
onMounted(async () => {
 try {
  // Check if we have a valid session (from the password reset link)
  const {
   data: { session },
  } = await supabase.auth.getSession()

  if (session) {
   pageStatus.value = 'ready'
  } else {
   // No session - might be an expired or invalid link
   pageError.value = 'This password reset link is invalid or has expired.'
   pageStatus.value = 'error'
  }
 } catch (err) {
  console.error('Error checking session:', err)
  pageError.value = 'An error occurred while verifying your reset link.'
  pageStatus.value = 'error'
 }
})

// Handle form submission
const handleSubmit = async () => {
 localError.value = null
 clearValidationErrors()

 const result = await updatePassword(password.value, confirmPassword.value)

 if (result.success) {
  pageStatus.value = 'success'
 } else if (result.error) {
  localError.value = result.error
 }
}

// Clear error when user starts typing
const handleInputChange = () => {
 if (localError.value) {
  localError.value = null
 }
 clearValidationErrors()
}

// Redirect to login
const goToLogin = () => {
 router.push('/auth/login')
}
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
   <!-- Loading State -->
   <template v-if="pageStatus === 'loading'">
    <CardContent
     class="flex flex-col items-center justify-center py-12 space-y-4"
    >
     <div class="p-4 bg-primary/10 rounded-full">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
     </div>
     <p class="text-foreground/80">Verifying reset link...</p>
    </CardContent>
   </template>

   <!-- Error State (Invalid/Expired Link) -->
   <template v-else-if="pageStatus === 'error'">
    <CardContent
     class="flex flex-col items-center justify-center py-12 space-y-6"
    >
     <div class="p-4 bg-destructive/10 rounded-full">
      <AlertCircle class="w-8 h-8 text-destructive" />
     </div>
     <div class="text-center space-y-2">
      <p class="text-destructive">{{ pageError }}</p>
      <p class="text-muted-foreground text-sm">
       Please request a new password reset link.
      </p>
     </div>
     <RouterLink to="/auth/forgot-password" class="w-full">
      <Button
       class="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      >
       Request new link
      </Button>
     </RouterLink>
     <RouterLink to="/auth/login">
      <Button
       variant="ghost"
       class="text-muted-foreground hover:text-foreground"
      >
       <ArrowLeft class="w-4 h-4 mr-2" />
       Back to login
      </Button>
     </RouterLink>
    </CardContent>
   </template>

   <!-- Success State -->
   <template v-else-if="pageStatus === 'success'">
    <CardContent
     class="flex flex-col items-center justify-center py-12 space-y-6"
    >
     <div class="p-4 bg-success/10 rounded-full">
      <CheckCircle2 class="w-8 h-8 text-success" />
     </div>
     <div class="text-center space-y-2">
      <h2 class="text-xl font-semibold text-foreground">Password updated!</h2>
      <p class="text-muted-foreground">
       Your password has been successfully changed.
      </p>
     </div>
     <Button
      class="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      @click="goToLogin"
     >
      Continue to login
     </Button>
    </CardContent>
   </template>

   <!-- Ready State (Form) -->
   <template v-else>
    <CardHeader class="space-y-4 text-center pb-2">
     <!-- Logo/Brand -->
     <div class="flex justify-center">
      <div class="p-3 bg-primary/10 rounded-xl border border-primary/20">
       <ShoppingCart class="w-8 h-8 text-primary" />
      </div>
     </div>

     <div class="space-y-2">
      <CardTitle class="text-2xl font-bold text-foreground">
       Set new password
      </CardTitle>
      <p class="text-muted-foreground text-sm">
       Create a strong password for your account
      </p>
     </div>
    </CardHeader>

    <CardContent class="space-y-6 pt-4">
     <!-- Error Message -->
     <div
      v-if="displayError"
      class="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
     >
      <AlertCircle class="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
      <div class="text-sm text-destructive">
       {{ displayError }}
      </div>
     </div>

     <!-- Reset Password Form -->
     <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- New Password Field -->
      <div class="space-y-2">
       <Label for="password" class="text-foreground/80">New Password</Label>
       <div class="relative">
        <Lock
         class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
        />
        <Input
         id="password"
         v-model="password"
         :type="showPassword ? 'text' : 'password'"
         placeholder="Enter new password"
         autocomplete="new-password"
         :disabled="isLoading"
         class="pl-10 pr-10 bg-card/50 border-border text-foreground placeholder:text-muted-foreground focus:border-ring"
         @input="handleInputChange"
        />
        <button
         type="button"
         class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80 transition-colors"
         @click="showPassword = !showPassword"
         :aria-label="showPassword ? 'Hide password' : 'Show password'"
        >
         <EyeOff v-if="showPassword" class="w-4 h-4" />
         <Eye v-else class="w-4 h-4" />
        </button>
       </div>

       <!-- Password Strength Indicator -->
       <div v-if="password" class="space-y-1">
        <div class="flex gap-1">
         <div
          v-for="i in 4"
          :key="i"
          class="h-1 flex-1 rounded-full transition-colors"
          :class="[
           i <= passwordStrength.level
            ? passwordStrength.color
            : 'bg-secondary',
          ]"
         />
        </div>
        <p
         class="text-xs"
         :class="passwordStrength.color.replace('bg-', 'text-')"
        >
         {{ passwordStrength.text }}
        </p>
       </div>
      </div>

      <!-- Confirm Password Field -->
      <div class="space-y-2">
       <Label for="confirmPassword" class="text-foreground/80">
        Confirm Password
       </Label>
       <div class="relative">
        <Lock
         class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
        />
        <Input
         id="confirmPassword"
         v-model="confirmPassword"
         :type="showConfirmPassword ? 'text' : 'password'"
         placeholder="Confirm new password"
         autocomplete="new-password"
         :disabled="isLoading"
         class="pl-10 pr-10 bg-card/50 border-border text-foreground placeholder:text-muted-foreground focus:border-ring"
         @input="handleInputChange"
        />
        <button
         type="button"
         class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80 transition-colors"
         @click="showConfirmPassword = !showConfirmPassword"
         :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
        >
         <EyeOff v-if="showConfirmPassword" class="w-4 h-4" />
         <Eye v-else class="w-4 h-4" />
        </button>
       </div>

       <!-- Password Match Indicator -->
       <p
        v-if="confirmPassword && password !== confirmPassword"
        class="text-xs text-destructive"
       >
        Passwords do not match
       </p>
       <p
        v-else-if="confirmPassword && password === confirmPassword"
        class="text-xs text-success"
       >
        Passwords match
       </p>
      </div>

      <!-- Submit Button -->
      <Button
       type="submit"
       class="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
       :disabled="isLoading || !isFormValid"
      >
       <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
       {{ isLoading ? 'Updating...' : 'Update password' }}
      </Button>
     </form>

     <!-- Password Requirements -->
     <div class="text-xs text-muted-foreground space-y-1">
      <p>Password must:</p>
      <ul class="list-disc list-inside space-y-0.5">
       <li :class="password.length >= 8 ? 'text-success' : ''">
        Be at least 8 characters long
       </li>
       <li
        :class="
         /[A-Z]/.test(password) && /[a-z]/.test(password) ? 'text-success' : ''
        "
       >
        Include uppercase and lowercase letters
       </li>
       <li :class="/[0-9]/.test(password) ? 'text-success' : ''">
        Include at least one number
       </li>
      </ul>
     </div>
    </CardContent>
   </template>
  </Card>
 </div>
</template>

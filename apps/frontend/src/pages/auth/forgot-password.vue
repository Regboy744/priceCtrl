<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '@/composables/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
 AlertCircle,
 ArrowLeft,
 CheckCircle2,
 Loader2,
 Mail,
 ShoppingCart,
} from 'lucide-vue-next'

const {
 isLoading,
 validationErrors,
 sendPasswordReset,
 clearValidationErrors,
 sanitizeErrorMessage,
} = useAuth()

// Form state
const email = ref('')
const submitted = ref(false)
const localError = ref<string | null>(null)

// Combined error message
const displayError = computed(() => {
 if (localError.value) return sanitizeErrorMessage(localError.value)
 if (validationErrors.value.email) return validationErrors.value.email
 return null
})

// Handle form submission
const handleSubmit = async () => {
 localError.value = null
 clearValidationErrors()

 const result = await sendPasswordReset(email.value)

 if (result.success) {
  submitted.value = true
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

// Reset form to try again
const handleTryAgain = () => {
 submitted.value = false
 email.value = ''
 localError.value = null
 clearValidationErrors()
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
   <CardHeader class="space-y-4 text-center pb-2">
    <!-- Logo/Brand -->
    <div class="flex justify-center">
     <div class="p-3 bg-primary/10 rounded-xl border border-primary/20">
      <ShoppingCart class="w-8 h-8 text-primary" />
     </div>
    </div>

    <div class="space-y-2">
     <CardTitle class="text-2xl font-bold text-foreground">
      {{ submitted ? 'Check your email' : 'Forgot password?' }}
     </CardTitle>
     <p class="text-muted-foreground text-sm">
      {{
       submitted
        ? "We've sent you a password reset link"
        : "No worries, we'll send you reset instructions"
      }}
     </p>
    </div>
   </CardHeader>

   <CardContent class="space-y-6 pt-4">
    <!-- Success State -->
    <template v-if="submitted">
     <div class="flex flex-col items-center space-y-4 py-4">
      <div class="p-4 bg-success/10 rounded-full">
       <CheckCircle2 class="w-8 h-8 text-success" />
      </div>
      <div class="text-center space-y-2">
       <p class="text-foreground/80">We've sent a password reset link to:</p>
       <p class="text-foreground font-medium">{{ email }}</p>
       <p class="text-muted-foreground text-sm">
        Please check your inbox and spam folder.
       </p>
      </div>
     </div>

     <div class="space-y-3">
      <Button
       variant="outline"
       class="w-full border-border text-foreground hover:bg-accent"
       @click="handleTryAgain"
      >
       Try a different email
      </Button>

      <RouterLink to="/auth/login" class="block">
       <Button
        variant="ghost"
        class="w-full text-muted-foreground hover:text-foreground hover:bg-accent"
       >
        <ArrowLeft class="w-4 h-4 mr-2" />
        Back to login
       </Button>
      </RouterLink>
     </div>
    </template>

    <!-- Form State -->
    <template v-else>
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
      </div>

      <!-- Submit Button -->
      <Button
       type="submit"
       class="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
       :disabled="isLoading || !email.trim()"
      >
       <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
       {{ isLoading ? 'Sending...' : 'Send reset link' }}
      </Button>
     </form>

     <!-- Back to Login -->
     <RouterLink to="/auth/login" class="block">
      <Button
       variant="ghost"
       class="w-full text-muted-foreground hover:text-foreground hover:bg-accent"
      >
       <ArrowLeft class="w-4 h-4 mr-2" />
       Back to login
      </Button>
     </RouterLink>
    </template>
   </CardContent>
  </Card>
 </div>
</template>

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/**
 * Email validation regex (RFC 5322 simplified)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Minimum password length
 */
const MIN_PASSWORD_LENGTH = 8

/**
 * Validation errors interface
 */
export interface ValidationErrors {
 email?: string
 password?: string
 confirmPassword?: string
}

/**
 * Composable for auth-related operations and validation
 * Provides a cleaner interface for components
 */
export function useAuth() {
 const authStore = useAuthStore()
 const router = useRouter()

 // Local reactive state for form handling
 const validationErrors = ref<ValidationErrors>({})

 // Computed properties from store
 const isAuthenticated = computed(() => authStore.isAuthenticated)
 const isLoading = computed(() => authStore.isLoading)
 const error = computed(() => authStore.error)
 const user = computed(() => authStore.user)
 const profile = computed(() => authStore.profile)
 const userRole = computed(() => authStore.userRole)
 const userFullName = computed(() => authStore.userFullName)
 const userEmail = computed(() => authStore.userEmail)
 const userAvatar = computed(() => authStore.userAvatar)
 const userInitials = computed(() => authStore.userInitials)

 /**
  * Validate email format
  */
 const validateEmail = (email: string): string | undefined => {
  const trimmedEmail = email.trim()
  if (!trimmedEmail) {
   return 'Email is required'
  }
  if (!EMAIL_REGEX.test(trimmedEmail)) {
   return 'Please enter a valid email address'
  }
  return undefined
 }

 /**
  * Validate password
  */
 const validatePassword = (password: string): string | undefined => {
  if (!password) {
   return 'Password is required'
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
   return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  return undefined
 }

 /**
  * Validate password confirmation
  */
 const validateConfirmPassword = (
  password: string,
  confirmPassword: string,
 ): string | undefined => {
  if (!confirmPassword) {
   return 'Please confirm your password'
  }
  if (password !== confirmPassword) {
   return 'Passwords do not match'
  }
  return undefined
 }

 /**
  * Validate login form
  */
 const validateLoginForm = (
  email: string,
  password: string,
 ): { isValid: boolean; errors: ValidationErrors } => {
  const errors: ValidationErrors = {}

  const emailError = validateEmail(email)
  if (emailError) errors.email = emailError

  const passwordError = validatePassword(password)
  if (passwordError) errors.password = passwordError

  validationErrors.value = errors
  return {
   isValid: Object.keys(errors).length === 0,
   errors,
  }
 }

 /**
  * Validate reset password form
  */
 const validateResetPasswordForm = (
  password: string,
  confirmPassword: string,
 ): { isValid: boolean; errors: ValidationErrors } => {
  const errors: ValidationErrors = {}

  const passwordError = validatePassword(password)
  if (passwordError) errors.password = passwordError

  const confirmError = validateConfirmPassword(password, confirmPassword)
  if (confirmError) errors.confirmPassword = confirmError

  validationErrors.value = errors
  return {
   isValid: Object.keys(errors).length === 0,
   errors,
  }
 }

 /**
  * Clear validation errors
  */
 const clearValidationErrors = (): void => {
  validationErrors.value = {}
 }

 /**
  * Sign in with email and password
  */
 const signIn = async (
  email: string,
  password: string,
  rememberMe: boolean = false,
  redirectTo: string = '/app',
 ): Promise<{ success: boolean; error?: string }> => {
  // Validate form
  const { isValid, errors } = validateLoginForm(email, password)
  if (!isValid) {
   return { success: false, error: Object.values(errors)[0] }
  }

  // Attempt sign in
  const result = await authStore.signIn(email, password, rememberMe)

  if (result.success) {
   // Redirect on success
   await router.push(redirectTo)
  }

  return result
 }

 /**
  * Sign out and redirect to login
  */
 const signOut = async (redirectTo: string = '/auth/login'): Promise<void> => {
  await authStore.signOut()
  await router.push(redirectTo)
 }

 /**
  * Send password reset email
  */
 const sendPasswordReset = async (
  email: string,
 ): Promise<{ success: boolean; error?: string }> => {
  // Validate email
  const emailError = validateEmail(email)
  if (emailError) {
   validationErrors.value = { email: emailError }
   return { success: false, error: emailError }
  }

  return await authStore.sendPasswordReset(email)
 }

 /**
  * Update password (for reset password flow)
  */
 const updatePassword = async (
  password: string,
  confirmPassword: string,
 ): Promise<{ success: boolean; error?: string }> => {
  // Validate passwords
  const { isValid, errors } = validateResetPasswordForm(
   password,
   confirmPassword,
  )
  if (!isValid) {
   return { success: false, error: Object.values(errors)[0] }
  }

  const result = await authStore.updatePassword(password)

  if (result.success) {
   // Redirect to login after successful password update
   await router.push('/auth/login?message=password-updated')
  }

  return result
 }

 /**
  * Get backoff delay for failed attempts (for UI display)
  */
 const getBackoffDelay = (): number => {
  return authStore.getBackoffDelay()
 }

 /**
  * Get failed attempts count
  */
 const failedAttempts = computed(() => authStore.failedAttempts)

 /**
  * Check if rate limited (based on backoff)
  */
 const isRateLimited = computed(() => authStore.getBackoffDelay() > 0)

 /**
  * Update activity timestamp (for session management)
  */
 const updateActivity = (): void => {
  authStore.updateLastActivity()
 }

 /**
  * Sanitize error message to prevent XSS
  */
 const sanitizeErrorMessage = (message: string): string => {
  // Remove any HTML tags
  return message.replace(/<[^>]*>/g, '')
 }

 return {
  // State
  isAuthenticated,
  isLoading,
  error,
  user,
  profile,
  userRole,
  userFullName,
  userEmail,
  userAvatar,
  userInitials,
  validationErrors,
  failedAttempts,
  isRateLimited,

  // Validation
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateLoginForm,
  validateResetPasswordForm,
  clearValidationErrors,

  // Actions
  signIn,
  signOut,
  sendPasswordReset,
  updatePassword,
  getBackoffDelay,
  updateActivity,
  sanitizeErrorMessage,
 }
}

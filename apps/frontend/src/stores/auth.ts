import type { Session, User } from '@supabase/supabase-js'
import type { Database } from '@/types/shared/database.types'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { supabase } from '@/lib/supabaseClient'

// Type for user profile from database
type UserProfile = Database['public']['Tables']['user_profiles']['Row']

// Type for user roles
export type UserRole = 'master' | 'admin' | 'manager'

// Session storage keys
const STORAGE_KEYS = {
 REMEMBER_ME: 'auth_remember_me',
 LAST_ACTIVITY: 'auth_last_activity',
} as const

// Inactivity timeout in milliseconds (30 minutes)
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000

// Maximum backoff delay for failed attempts (30 seconds)
const MAX_BACKOFF_DELAY_MS = 30 * 1000

// Base backoff delay (1 second)
const BASE_BACKOFF_DELAY_MS = 1000

export const useAuthStore = defineStore('auth-store', () => {
 // State
 const user = ref<User | null>(null)
 const session = ref<Session | null>(null)
 const profile = ref<UserProfile | null>(null)
 const permissions = ref<string[]>([])
 const uiPermissions = ref<string[]>([])
 const isLoading = ref(false)
 const isInitialized = ref(false)
 const error = ref<string | null>(null)
 const lastActivity = ref<number>(Date.now())
 const failedAttempts = ref(0)
 const backoffUntil = ref(0)
 const backoffNow = ref(Date.now())
 let backoffTimer: ReturnType<typeof setInterval> | null = null

 // Getters
 const isAuthenticated = computed(() => !!session.value && !!user.value)

 const userRole = computed<UserRole | null>(() => {
  if (profile.value?.role) {
   return profile.value.role as UserRole
  }
  // Fallback to JWT claims if profile not loaded yet
  if (session.value?.access_token) {
   try {
    const tokenParts = session.value.access_token.split('.')
    if (tokenParts[1]) {
     const payload = JSON.parse(atob(tokenParts[1]))
     return payload.user_role as UserRole
    }
   } catch {
    return null
   }
  }
  return null
 })

 const companyId = computed<string | null>(() => {
  if (profile.value?.company_id) {
   return profile.value.company_id
  }
  // Fallback to JWT claims
  if (session.value?.access_token) {
   try {
    const tokenParts = session.value.access_token.split('.')
    if (tokenParts[1]) {
     const payload = JSON.parse(atob(tokenParts[1]))
     return payload.company_id || null
    }
   } catch {
    return null
   }
  }
  return null
 })

 const locationId = computed<string | null>(() => {
  if (profile.value?.location_id) {
   return profile.value.location_id
  }
  // Fallback to JWT claims
  if (session.value?.access_token) {
   try {
    const tokenParts = session.value.access_token.split('.')
    if (tokenParts[1]) {
     const payload = JSON.parse(atob(tokenParts[1]))
     return payload.location_id || null
    }
   } catch {
    return null
   }
  }
  return null
 })

 const userFullName = computed(() => {
  if (profile.value) {
   return `${profile.value.first_name} ${profile.value.last_name}`
  }
  return user.value?.email || 'User'
 })

 const userEmail = computed(() => user.value?.email || '')

 const userAvatar = computed(() => profile.value?.avatar_url || '')

 const userInitials = computed(() => {
  if (profile.value?.first_name && profile.value?.last_name) {
   return `${profile.value.first_name[0]}${profile.value.last_name[0]}`.toUpperCase()
  }
  if (user.value?.email) {
   return user.value.email.substring(0, 2).toUpperCase()
  }
  return 'U'
 })

 const updateBackoffNow = (): void => {
  backoffNow.value = Date.now()
  if (backoffUntil.value > 0 && backoffNow.value >= backoffUntil.value) {
   backoffUntil.value = 0
   if (backoffTimer) {
    clearInterval(backoffTimer)
    backoffTimer = null
   }
  }
 }

 const startBackoffTimer = (): void => {
  if (backoffTimer) return
  backoffTimer = setInterval(updateBackoffNow, 1000)
 }

 const stopBackoffTimer = (): void => {
  if (!backoffTimer) return
  clearInterval(backoffTimer)
  backoffTimer = null
 }

 const setBackoff = (delayMs: number): void => {
  if (delayMs <= 0) {
   backoffUntil.value = 0
   stopBackoffTimer()
   return
  }

  backoffUntil.value = Date.now() + delayMs
  updateBackoffNow()
  startBackoffTimer()
 }

 // Calculate backoff delay based on failed attempts
 const getBackoffDelayForAttempt = (attempts: number): number => {
  if (attempts <= 0) return 0
  const delay = BASE_BACKOFF_DELAY_MS * Math.pow(2, attempts - 1)
  return Math.min(delay, MAX_BACKOFF_DELAY_MS)
 }

 // Remaining backoff time in milliseconds
 const getBackoffDelay = (): number => {
  if (backoffUntil.value <= 0) return 0
  const remaining = backoffUntil.value - backoffNow.value
  return Math.max(0, remaining)
 }

 // Fetch identity + permissions from backend /me. Backend is the
 // single source of truth — registry-computed permissions plus the
 // full user_profiles row in one round-trip.
 interface MeResponse {
  email: string
  profile: UserProfile
  permissions: string[]
  ui_permissions: string[]
 }

 const fetchMe = async (): Promise<void> => {
  try {
   const response = await apiClient.get<MeResponse>('/me')
   if (!response.success || !response.data) {
    console.error('Error fetching /me:', response.error)
    profile.value = null
    permissions.value = []
    uiPermissions.value = []
    return
   }
   profile.value = response.data.profile
   permissions.value = response.data.permissions
   uiPermissions.value = response.data.ui_permissions
  } catch (err) {
   console.error('Error fetching /me:', err)
  }
 }

 // Initialize session on app load
 const initSession = async (): Promise<void> => {
  if (isInitialized.value) return

  isLoading.value = true
  error.value = null

  try {
   const { data, error: sessionError } = await supabase.auth.getSession()

   if (sessionError) {
    console.error('Error getting session:', sessionError)
    error.value = sessionError.message
    return
   }

   if (data.session) {
    session.value = data.session
    user.value = data.session.user

    // Restore last activity from storage
    const storedLastActivity = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY)
    if (storedLastActivity) {
     lastActivity.value = parseInt(storedLastActivity, 10)
    }

    // Check if session has timed out due to inactivity
    const rememberMe = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true'
    if (
     !rememberMe &&
     Date.now() - lastActivity.value > INACTIVITY_TIMEOUT_MS
    ) {
     // Session timed out, sign out
     await signOut()
     return
    }

    // Fetch identity + permissions from backend
    await fetchMe()

    // Update last activity
    updateLastActivity()
   }
  } catch (err) {
   console.error('Error initializing session:', err)
   error.value =
    err instanceof Error ? err.message : 'Failed to initialize session'
  } finally {
   isLoading.value = false
   isInitialized.value = true
  }
 }

 // Sign in with email and password
 const signIn = async (
  email: string,
  password: string,
  rememberMe: boolean = false,
 ): Promise<{ success: boolean; error?: string }> => {
  isLoading.value = true
  error.value = null

  // Check backoff delay
  const backoffDelay = getBackoffDelay()
  if (backoffDelay > 0) {
   await new Promise((resolve) => setTimeout(resolve, backoffDelay))
  }

  try {
   const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
   })

   if (signInError) {
    failedAttempts.value++
    setBackoff(getBackoffDelayForAttempt(failedAttempts.value))

    // Handle specific error cases
    if (signInError.status === 429) {
     error.value = 'Too many login attempts. Please try again later.'
    } else if (signInError.message.includes('Invalid login credentials')) {
     error.value = 'Invalid email or password'
    } else {
     error.value = signInError.message
    }

    return { success: false, error: error.value }
   }

   // Reset failed attempts on success
   failedAttempts.value = 0
   setBackoff(0)

   // Store remember me preference
   localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, rememberMe.toString())

   // Set session data
   session.value = data.session
   user.value = data.user

   // Fetch identity + permissions from backend
   if (data.user) {
    await fetchMe()
   }

   // Update last activity
   updateLastActivity()

   return { success: true }
  } catch (err) {
   failedAttempts.value++
   setBackoff(getBackoffDelayForAttempt(failedAttempts.value))
   const errorMessage =
    err instanceof Error ? err.message : 'An unexpected error occurred'
   error.value = errorMessage
   return { success: false, error: errorMessage }
  } finally {
   isLoading.value = false
  }
 }

 // Sign out
 const signOut = async (): Promise<void> => {
  isLoading.value = true
  error.value = null

  try {
   const { error: signOutError } = await supabase.auth.signOut()

   if (signOutError) {
    console.error('Error signing out:', signOutError)
    error.value = signOutError.message
   }
  } catch (err) {
   console.error('Error signing out:', err)
   error.value = err instanceof Error ? err.message : 'Failed to sign out'
  } finally {
   // Clear all state regardless of error
   clearAuthState()
   isLoading.value = false
  }
 }

 // Clear all auth state
 const clearAuthState = (): void => {
  user.value = null
  session.value = null
  profile.value = null
  permissions.value = []
  uiPermissions.value = []
  error.value = null
  failedAttempts.value = 0
  setBackoff(0)
  localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME)
  localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY)
 }

 // Update last activity timestamp
 const updateLastActivity = (): void => {
  lastActivity.value = Date.now()
  localStorage.setItem(
   STORAGE_KEYS.LAST_ACTIVITY,
   lastActivity.value.toString(),
  )
 }

 // Check for inactivity timeout
 const checkInactivityTimeout = (): boolean => {
  const rememberMe = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true'

  // If remember me is enabled, skip inactivity check
  if (rememberMe) return false

  // Check if session has timed out
  if (
   isAuthenticated.value &&
   Date.now() - lastActivity.value > INACTIVITY_TIMEOUT_MS
  ) {
   return true
  }

  return false
 }

 // Refresh session manually
 const refreshSession = async (): Promise<void> => {
  try {
   const { data, error: refreshError } = await supabase.auth.refreshSession()

   if (refreshError) {
    console.error('Error refreshing session:', refreshError)
    error.value = refreshError.message
    return
   }

   if (data.session) {
    session.value = data.session
    user.value = data.session.user
   }
  } catch (err) {
   console.error('Error refreshing session:', err)
   error.value =
    err instanceof Error ? err.message : 'Failed to refresh session'
  }
 }

 // Send password reset email
 const sendPasswordReset = async (
  email: string,
 ): Promise<{ success: boolean; error?: string }> => {
  isLoading.value = true
  error.value = null

  try {
   const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    email.trim(),
    {
     redirectTo: `${window.location.origin}/auth/reset-password`,
    },
   )

   if (resetError) {
    if (resetError.status === 429) {
     error.value = 'Too many requests. Please try again later.'
    } else {
     error.value = resetError.message
    }
    return { success: false, error: error.value }
   }

   return { success: true }
  } catch (err) {
   const errorMessage =
    err instanceof Error ? err.message : 'Failed to send reset email'
   error.value = errorMessage
   return { success: false, error: errorMessage }
  } finally {
   isLoading.value = false
  }
 }

 // Update password (for reset password flow)
 const updatePassword = async (
  newPassword: string,
 ): Promise<{ success: boolean; error?: string }> => {
  isLoading.value = true
  error.value = null

  try {
   const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
   })

   if (updateError) {
    error.value = updateError.message
    return { success: false, error: error.value }
   }

   return { success: true }
  } catch (err) {
   const errorMessage =
    err instanceof Error ? err.message : 'Failed to update password'
   error.value = errorMessage
   return { success: false, error: errorMessage }
  } finally {
   isLoading.value = false
  }
 }

 // Handle auth state changes from Supabase listener
 const handleAuthStateChange = async (
  event: string,
  newSession: Session | null,
 ): Promise<void> => {
  switch (event) {
   case 'SIGNED_IN':
    session.value = newSession
    user.value = newSession?.user || null
    if (newSession?.user) {
     await fetchMe()
    }
    updateLastActivity()
    break

   case 'SIGNED_OUT':
    clearAuthState()
    break

   case 'TOKEN_REFRESHED':
    session.value = newSession
    user.value = newSession?.user || null
    break

   case 'USER_UPDATED':
    user.value = newSession?.user || null
    if (newSession?.user) {
     await fetchMe()
    }
    break

   case 'PASSWORD_RECOVERY':
    // Session is set during password recovery flow
    session.value = newSession
    user.value = newSession?.user || null
    break
  }
 }

 return {
  // State
  user,
  session,
  profile,
  permissions,
  uiPermissions,
  isLoading,
  isInitialized,
  error,
  lastActivity,
  failedAttempts,

  // Getters
  isAuthenticated,
  userRole,
  companyId,
  locationId,
  userFullName,
  userEmail,
  userAvatar,
  userInitials,

  // Actions
  initSession,
  signIn,
  signOut,
  refreshSession,
  sendPasswordReset,
  updatePassword,
  updateLastActivity,
  checkInactivityTimeout,
  handleAuthStateChange,
  fetchMe,
  getBackoffDelay,
 }
})

if (import.meta.hot) {
 import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}

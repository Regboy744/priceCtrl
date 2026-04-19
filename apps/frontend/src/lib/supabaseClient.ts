import {
 createClient,
 type AuthChangeEvent,
 type Session,
} from '@supabase/supabase-js'
import type { Database } from '@/types/shared/database.types'

export const supabase = createClient<Database>(
 import.meta.env.VITE_SUPABASE_URL,
 import.meta.env.VITE_SB_PUBLISHABLE_KEY,
 {
  auth: {
   persistSession: true,
   autoRefreshToken: true,
   detectSessionInUrl: true,
  },
 },
)

/**
 * Auth state change callback type
 */
export type AuthStateChangeCallback = (
 event: AuthChangeEvent,
 session: Session | null,
) => void | Promise<void>

/**
 * Set up auth state change listener
 * This should be called once during app initialization
 *
 * @param callback - Function to call when auth state changes
 * @returns Unsubscribe function
 */
export function setupAuthListener(callback: AuthStateChangeCallback): {
 unsubscribe: () => void
} {
 const {
  data: { subscription },
 } = supabase.auth.onAuthStateChange((event, session) => {
  callback(event, session)
 })

 return {
  unsubscribe: () => subscription.unsubscribe(),
 }
}

/**
 * Get current session
 * Useful for checking auth state without going through the store
 */
export async function getCurrentSession(): Promise<Session | null> {
 const { data, error } = await supabase.auth.getSession()
 if (error) {
  console.error('Error getting session:', error)
  return null
 }
 return data.session
}

/**
 * Get current user
 * Useful for quick user checks
 */
export async function getCurrentUser() {
 const { data, error } = await supabase.auth.getUser()
 if (error) {
  console.error('Error getting user:', error)
  return null
 }
 return data.user
}

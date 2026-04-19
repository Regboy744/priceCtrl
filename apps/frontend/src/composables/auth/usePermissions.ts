import { computed } from 'vue'
import {
 hasPermission as registryHasPermission,
 isUiVisible as registryIsUiVisible,
 type Permission,
 type Role,
} from '@pricectrl/contracts/permissions'
import { useAuthStore, type UserRole } from '@/stores/auth'

/**
 * Role hierarchy (index = privilege level, higher is more privileged)
 * manager < admin < master
 */
const ROLE_HIERARCHY: UserRole[] = ['manager', 'admin', 'master']

export type { Permission }

/**
 * Composable for checking user permissions and roles.
 *
 * All checks delegate to the shared permission registry
 * (`@pricectrl/contracts/permissions`) — the single source
 * of truth mirrored by backend middleware and Supabase RLS.
 *
 * UI-visibility checks (`canSee`) consult the registry's
 * `uiVisibleTo` override; logical checks (`can`, `hasPermission`)
 * use the raw `roles` list. Server still enforces — client checks
 * are defensive only.
 */
export function usePermissions() {
 const authStore = useAuthStore()

 const currentRole = computed<UserRole | null>(() => authStore.userRole)

 const hasPermission = (permission: Permission): boolean => {
  const role = authStore.userRole as Role | null
  if (!role) return false
  return registryHasPermission(role, permission)
 }

 /**
  * Should this permission's UI be rendered for the current role?
  * Honors `uiVisibleTo` — e.g. `orders:send` is allowed for master
  * on the server but hidden in the UI.
  */
 const canSee = (permission: Permission): boolean => {
  const role = authStore.userRole as Role | null
  if (!role) return false
  return registryIsUiVisible(role, permission)
 }

 const hasRole = (role: UserRole): boolean => authStore.userRole === role

 const hasAnyRole = (roles: UserRole[]): boolean => {
  const role = authStore.userRole
  if (!role) return false
  return roles.includes(role)
 }

 /**
  * Check if user's role is at least as privileged as the specified role.
  * Kept for legacy call sites; prefer explicit `can(permission)`.
  */
 const isAtLeastRole = (minRole: UserRole): boolean => {
  const role = authStore.userRole
  if (!role) return false
  return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(minRole)
 }

 /**
  * Preferred API: `can('resource:action')` — registry-backed.
  */
 const can = (permission: Permission): boolean => hasPermission(permission)

 const isMaster = computed(() => hasRole('master'))
 const isAdmin = computed(() => hasRole('admin'))
 const isManager = computed(() => hasRole('manager'))

 /** Full permission list for the current role, pulled from the auth store. */
 const userPermissions = computed<string[]>(() => authStore.permissions)

 /** UI-visible subset, pulled from the auth store. */
 const uiPermissions = computed<string[]>(() => authStore.uiPermissions)

 const hasAllPermissions = (permissions: Permission[]): boolean =>
  permissions.every((permission) => hasPermission(permission))

 const hasAnyPermission = (permissions: Permission[]): boolean =>
  permissions.some((permission) => hasPermission(permission))

 return {
  // Getters
  currentRole,
  isMaster,
  isAdmin,
  isManager,
  userPermissions,
  uiPermissions,

  // Methods
  hasPermission,
  canSee,
  hasRole,
  hasAnyRole,
  isAtLeastRole,
  can,
  hasAllPermissions,
  hasAnyPermission,
 }
}

export { ROLE_HIERARCHY }

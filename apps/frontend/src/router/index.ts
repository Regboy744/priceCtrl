import { createRouter, createWebHistory } from 'vue-router'
import type { RouteLocationNormalized } from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/stores/auth'

// Extend RouteMeta interface for typed route meta
declare module 'vue-router' {
 interface RouteMeta {
  /**
   * If true, requires user to be authenticated
   */
  requiresAuth?: boolean
  /**
   * If true, only accessible to unauthenticated users (login, register, etc.)
   */
  guestOnly?: boolean
  /**
   * Array of roles that can access this route
   */
  allowedRoles?: UserRole[]
 }
}

/**
 * Check if a route path starts with a given prefix
 */
const routeStartsWith = (
 route: RouteLocationNormalized,
 prefix: string,
): boolean => {
 return route.path.startsWith(prefix)
}

/**
 * Configure route meta based on path patterns
 * Since we use file-based routing, we set meta programmatically
 */
const getRouteMeta = (route: RouteLocationNormalized) => {
 // Auth routes (login, forgot-password, etc.) - guest only
 if (routeStartsWith(route, '/auth/')) {
  return {
   guestOnly: true,
   requiresAuth: false,
  }
 }

 // App routes - require authentication
 if (routeStartsWith(route, '/app')) {
  return {
   requiresAuth: true,
   guestOnly: false,
  }
 }

 // Public routes (landing page, etc.)
 return {
  requiresAuth: false,
  guestOnly: false,
 }
}

const router = createRouter({
 history: createWebHistory(import.meta.env.BASE_URL),
 routes,
})

/**
 * Navigation guard for authentication and authorization
 */
router.beforeEach(async (to, from, next) => {
 const authStore = useAuthStore()

 // Initialize auth session on first navigation
 if (!authStore.isInitialized) {
  await authStore.initSession()
 }

 // Get route meta (either from route definition or computed)
 const meta = {
  ...getRouteMeta(to),
  ...to.meta,
 }

 const isAuthenticated = authStore.isAuthenticated

 // Check for inactivity timeout (only for authenticated users)
 if (isAuthenticated && authStore.checkInactivityTimeout()) {
  // Session timed out due to inactivity
  await authStore.signOut()
  return next({
   path: '/auth/login',
   query: {
    redirect: to.fullPath,
    reason: 'session-timeout',
   },
  })
 }

 // Guest-only routes (login, register, etc.)
 if (meta.guestOnly && isAuthenticated) {
  // Redirect authenticated users away from guest-only pages
  return next('/app')
 }

 // Protected routes
 if (meta.requiresAuth && !isAuthenticated) {
  // Redirect unauthenticated users to login
  return next({
   path: '/auth/login',
   query: {
    redirect: to.fullPath,
   },
  })
 }

 // Role-based access control
 if (meta.allowedRoles && meta.allowedRoles.length > 0) {
  const userRole = authStore.userRole

  if (!userRole || !meta.allowedRoles.includes(userRole)) {
   // User doesn't have required role
   // Redirect to app home with access denied message
   console.warn(
    `Access denied: User role "${userRole}" not in allowed roles:`,
    meta.allowedRoles,
   )
   return next({
    path: '/app',
    query: {
     error: 'access-denied',
    },
   })
  }
 }

 // Update last activity timestamp for authenticated users
 if (isAuthenticated) {
  authStore.updateLastActivity()
 }

 // Continue navigation
 next()
})

/**
 * After each navigation, update document title or perform other tasks
 */
router.afterEach(() => {
 // Update activity timestamp for authenticated users
 const authStore = useAuthStore()
 if (authStore.isAuthenticated) {
  authStore.updateLastActivity()
 }
})

// This will update routes at runtime without reloading the page
if (import.meta.hot) {
 handleHotUpdate(router)
}

export default router

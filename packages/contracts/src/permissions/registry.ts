import type { PermissionRule } from './types.js';

/**
 * Single source of truth for all application permissions.
 *
 * Keys follow the pattern `resource:action` (or `resource:action:qualifier`).
 * `roles` lists every role permitted to perform the action.
 * `uiVisibleTo` (optional) narrows which roles see the UI affordance
 * for the action — defaults to `roles` when omitted. Used when an action
 * must remain possible server-side for a role but hidden from their UI.
 *
 * Scope is derived from the role performing the action:
 *   master  → global  (no row filter)
 *   admin   → company (row.company_id === jwt.company_id)
 *   manager → location (row.location_id === jwt.location_id)
 *
 * Resources without `company_id`/`location_id` columns are effectively
 * global for any role that has the permission (no filter can be applied).
 */
export const PERMISSIONS = {
  // ───── Platform catalog ─────
  'brands:read':                  { roles: ['master', 'admin', 'manager'] },
  'brands:write':                 { roles: ['master'] },
  'brands:delete':                { roles: ['master'] },

  'suppliers:read':               { roles: ['master', 'admin', 'manager'] },
  'suppliers:write':              { roles: ['master'] },
  'suppliers:delete':             { roles: ['master'] },

  'supplier_products:read':       { roles: ['master', 'admin', 'manager'] },
  'supplier_products:write':      { roles: ['master'] },
  'supplier_products:delete':     { roles: ['master'] },

  'master_products:read':         { roles: ['master', 'admin', 'manager'] },
  'master_products:write':        { roles: ['master', 'admin', 'manager'] },
  'master_products:delete':       { roles: ['master'] },

  'supplier_price_history:read':  { roles: ['master', 'admin', 'manager'] },
  'supplier_price_history:write': { roles: ['master'] },

  // ───── Company-scoped ─────
  'companies:read':               { roles: ['master', 'admin', 'manager'] },
  'companies:write':              { roles: ['master'] },
  'companies:delete':             { roles: ['master'] },

  'locations:read':               { roles: ['master', 'admin', 'manager'] },
  'locations:create':             { roles: ['master'] },
  'locations:update':             { roles: ['master'] },
  'locations:delete':             { roles: ['master'] },
  'locations:update:address':     { roles: ['master', 'admin'] },

  'addresses:read':               { roles: ['master', 'admin', 'manager'] },
  'addresses:write':              { roles: ['master', 'admin'] },
  'addresses:delete':             { roles: ['master', 'admin'] },

  'user_profiles:read':           { roles: ['master', 'admin'] },
  'user_profiles:write':          { roles: ['master'] },
  'user_profiles:delete':         { roles: ['master'] },

  'company_supplier_settings:read':  { roles: ['master', 'admin', 'manager'] },
  'company_supplier_settings:write': { roles: ['master', 'admin'] },

  'supplier_company_prices:read':    { roles: ['master', 'admin', 'manager'] },
  'supplier_company_prices:write':   { roles: ['master'] },

  'ssrs:read':                       { roles: ['master', 'admin', 'manager'] },
  'ssrs:write':                      { roles: ['master'] },

  'savings_calculations:read':       { roles: ['master', 'admin', 'manager'] },

  // ───── Location-scoped ─────
  'location_supplier_credentials:read':   { roles: ['master', 'admin', 'manager'] },
  'location_supplier_credentials:write':  { roles: ['master', 'admin', 'manager'] },
  'location_supplier_credentials:delete': { roles: ['master', 'admin', 'manager'] },

  'orders:read':                  { roles: ['master', 'admin', 'manager'] },
  'orders:send':                  { roles: ['master', 'manager'], uiVisibleTo: ['manager'] },
  'orders:update':                { roles: ['master'] },
  'orders:delete':                { roles: ['master'] },

  'order_items:read':             { roles: ['master', 'admin', 'manager'] },
  'order_items:write':            { roles: ['master', 'manager'], uiVisibleTo: ['manager'] },

  // ───── Actions ─────
  'price_check:run':              { roles: ['master', 'admin', 'manager'] },
  'scraping:trigger':             { roles: ['master'] },
  'reports:export':               { roles: ['master', 'admin', 'manager'] },
} as const satisfies Record<string, PermissionRule>;

export type Permission = keyof typeof PERMISSIONS;

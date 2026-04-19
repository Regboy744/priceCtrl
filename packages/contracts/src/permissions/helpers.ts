import { PERMISSIONS, type Permission } from './registry.js';
import type { JwtClaims, PermissionRule, Role, Scope, ScopedResource } from './types.js';

function rule(permission: Permission): PermissionRule {
  return PERMISSIONS[permission] as PermissionRule;
}

/**
 * Returns the natural scope for a role — the narrowest row filter applied
 * to resources the role touches when the resource is company- or
 * location-scoped.
 */
export function getRoleScope(role: Role): Scope {
  if (role === 'master') return 'global';
  if (role === 'admin') return 'company';
  return 'location';
}

/**
 * True if the role is allowed to perform the permission at the RLS /
 * backend level. Does not check row scope — use `canAccessResource` for
 * row-level checks.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return rule(permission).roles.includes(role);
}

/**
 * True if the UI should show the affordance for this permission to this
 * role. Defaults to `hasPermission` unless the rule sets `uiVisibleTo`.
 */
export function isUiVisible(role: Role, permission: Permission): boolean {
  const r = rule(permission);
  const visible = r.uiVisibleTo ?? r.roles;
  return visible.includes(role);
}

/**
 * True if the user may access a specific scoped resource row.
 * Master bypasses scope checks. Admin checks company_id. Manager
 * checks location_id. Rows without the relevant scope column are
 * treated as accessible (catalog data shared across tenants).
 */
export function canAccessResource(
  claims: JwtClaims,
  resource: ScopedResource
): boolean {
  if (claims.role === 'master') return true;
  if (claims.role === 'admin') {
    if (resource.company_id == null) return true;
    return resource.company_id === claims.company_id;
  }
  if (resource.location_id == null) return true;
  return resource.location_id === claims.location_id;
}

/**
 * Returns every permission granted to a role — the effective server-side
 * permission list. Unaffected by `uiVisibleTo`.
 */
export function permissionsForRole(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) =>
    hasPermission(role, p)
  );
}

/**
 * Returns every permission whose UI affordance should be shown for a
 * role. Respects `uiVisibleTo`.
 */
export function uiPermissionsForRole(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) =>
    isUiVisible(role, p)
  );
}

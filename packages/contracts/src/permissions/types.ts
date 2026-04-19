export type Role = 'master' | 'admin' | 'manager';

export type Scope = 'global' | 'company' | 'location';

export interface PermissionRule {
  readonly roles: readonly Role[];
  readonly uiVisibleTo?: readonly Role[];
}

export interface JwtClaims {
  readonly role: Role;
  readonly company_id?: string | null;
  readonly location_id?: string | null;
}

export interface ScopedResource {
  readonly company_id?: string | null;
  readonly location_id?: string | null;
}

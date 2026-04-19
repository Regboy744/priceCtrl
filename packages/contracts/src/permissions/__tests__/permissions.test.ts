import { describe, expect, it } from 'vitest';
import {
  canAccessResource,
  getRoleScope,
  hasPermission,
  isUiVisible,
  permissionsForRole,
  uiPermissionsForRole,
} from '../helpers.js';

describe('permissions registry', () => {
  describe('getRoleScope', () => {
    it('maps roles to natural scope', () => {
      expect(getRoleScope('master')).toBe('global');
      expect(getRoleScope('admin')).toBe('company');
      expect(getRoleScope('manager')).toBe('location');
    });
  });

  describe('hasPermission', () => {
    it('grants master everything it should have', () => {
      expect(hasPermission('master', 'orders:send')).toBe(true);
      expect(hasPermission('master', 'scraping:trigger')).toBe(true);
      expect(hasPermission('master', 'orders:delete')).toBe(true);
    });

    it('grants manager send orders but not admin', () => {
      expect(hasPermission('manager', 'orders:send')).toBe(true);
      expect(hasPermission('admin', 'orders:send')).toBe(false);
    });

    it('denies admin + manager order deletes', () => {
      expect(hasPermission('admin', 'orders:delete')).toBe(false);
      expect(hasPermission('manager', 'orders:delete')).toBe(false);
    });

    it('lets admin edit company settings but not manager', () => {
      expect(hasPermission('admin', 'company_supplier_settings:write')).toBe(true);
      expect(hasPermission('manager', 'company_supplier_settings:write')).toBe(false);
    });

    it('lets all roles write master_products', () => {
      expect(hasPermission('master', 'master_products:write')).toBe(true);
      expect(hasPermission('admin', 'master_products:write')).toBe(true);
      expect(hasPermission('manager', 'master_products:write')).toBe(true);
    });

    it('restricts master_products delete to master', () => {
      expect(hasPermission('admin', 'master_products:delete')).toBe(false);
      expect(hasPermission('manager', 'master_products:delete')).toBe(false);
    });
  });

  describe('isUiVisible', () => {
    it('hides orders:send from master in UI despite server permission', () => {
      expect(hasPermission('master', 'orders:send')).toBe(true);
      expect(isUiVisible('master', 'orders:send')).toBe(false);
    });

    it('shows orders:send UI to manager', () => {
      expect(isUiVisible('manager', 'orders:send')).toBe(true);
    });

    it('defaults uiVisibleTo to roles when not specified', () => {
      expect(isUiVisible('admin', 'company_supplier_settings:write')).toBe(true);
      expect(isUiVisible('manager', 'company_supplier_settings:write')).toBe(false);
    });
  });

  describe('canAccessResource', () => {
    it('master bypasses all scope checks', () => {
      const claims = { role: 'master' as const };
      expect(canAccessResource(claims, { company_id: 'X' })).toBe(true);
      expect(canAccessResource(claims, { location_id: 'Y' })).toBe(true);
    });

    it('admin matched by company_id', () => {
      const claims = { role: 'admin' as const, company_id: 'co1' };
      expect(canAccessResource(claims, { company_id: 'co1' })).toBe(true);
      expect(canAccessResource(claims, { company_id: 'co2' })).toBe(false);
    });

    it('manager matched by location_id', () => {
      const claims = { role: 'manager' as const, location_id: 'loc1' };
      expect(canAccessResource(claims, { location_id: 'loc1' })).toBe(true);
      expect(canAccessResource(claims, { location_id: 'loc2' })).toBe(false);
    });

    it('passes when resource has no scope column (catalog rows)', () => {
      const admin = { role: 'admin' as const, company_id: 'co1' };
      const manager = { role: 'manager' as const, location_id: 'loc1' };
      expect(canAccessResource(admin, {})).toBe(true);
      expect(canAccessResource(manager, {})).toBe(true);
    });
  });

  describe('list helpers', () => {
    it('permissionsForRole returns server-side grants', () => {
      const master = permissionsForRole('master');
      expect(master).toContain('orders:send');
      expect(master).toContain('scraping:trigger');
    });

    it('uiPermissionsForRole respects uiVisibleTo', () => {
      const master = uiPermissionsForRole('master');
      expect(master).not.toContain('orders:send');
      const manager = uiPermissionsForRole('manager');
      expect(manager).toContain('orders:send');
    });
  });
});

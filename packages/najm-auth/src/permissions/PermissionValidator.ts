import { Injectable } from 'najm-core';
import { I18n, type TFn } from 'najm-i18n';
import { Err } from 'najm-core';
import { PermissionRepository } from './PermissionRepository';
import { RoleValidator } from '../roles';

/**
 * PermissionValidator - Business validation for permission operations
 * Handles database checks (unique, exists, role permissions)
 * Schema validation is handled by DTOs in permission.dto.ts
 */
@Injectable()
export class PermissionValidator {
  @I18n('permissions') private t!: TFn;

  constructor(
    private permissionRepository: PermissionRepository,
    private roleValidator: RoleValidator
  ) {}

  /**
   * Check if permission exists by ID
   */
  async checkPermissionExists(id: string) {
    const permission = await this.permissionRepository.getById(id);
    if (!permission) {
      Err(this.t('errors.notFound'), 404);
    }
    return permission;
  }

  /**
   * Check if permission exists by name
   */
  async checkPermissionExistsByName(name: string) {
    const permission = await this.permissionRepository.getByName(name);
    if (!permission) {
      Err(this.t('errors.notFound'), 404);
    }
    return permission;
  }

  /**
   * Check if permission name is unique
   */
  async checkPermissionNameUnique(name: string, excludeId?: string) {
    if (!name) return;
    const existingPermission = await this.permissionRepository.getByName(name);
    if (existingPermission && existingPermission.id !== excludeId) {
      Err(this.t('errors.nameExists'), 409);
    }
  }

  /**
   * Check if role exists (delegates to RoleValidator)
   */
  async checkRoleExists(id: string) {
    return await this.roleValidator.checkRoleExists(id);
  }

  /**
   * Check if role exists by name (delegates to RoleValidator)
   */
  async checkRoleExistsByName(name: string) {
    return await this.roleValidator.checkRoleExistsByName(name);
  }

  /**
   * Check if role already has permission
   */
  async checkRoleHasPermission(roleId: string, permissionId: string) {
    await this.roleValidator.checkRoleExists(roleId);
    await this.checkPermissionExists(permissionId);

    const hasPermission = await this.permissionRepository.checkRoleHasPermission(roleId, permissionId);
    if (hasPermission) {
      Err(this.t('errors.roleAlreadyHasPermission'), 409);
    }
  }

}
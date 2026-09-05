import { Injectable } from 'najm-core';
import { PermissionRepository } from './PermissionRepository';
import { PermissionValidator } from './PermissionValidator';
import { RoleService } from '../roles/RoleService';
import { UserRepository } from '../users/UserRepository';
import { SessionInvalidationService } from '../tokens/SessionInvalidationService';

@Injectable()
export class PermissionService {
  constructor(
    private permissionRepository: PermissionRepository,
    private permissionValidator: PermissionValidator,
    private roleService: RoleService,
    private userRepository?: UserRepository,
    private sessionInvalidation?: SessionInvalidationService,
  ) { }

  /**
   * End the sessions of everyone holding a role whose permission set changed.
   *
   * Access tokens and signed session snapshots both carry permissions as
   * claims, so a permission removed from a role stays exercisable until the
   * sessions that captured it end. This is an infrequent administrative
   * action, and the work is proportional to the role's membership.
   */
  private async invalidateRoleHolders(roleId: string): Promise<void> {
    if (!this.userRepository || !this.sessionInvalidation) return;
    const userIds = await this.userRepository.getIdsByRole(roleId);
    for (const userId of userIds) {
      await this.sessionInvalidation.invalidateAccessTokens(userId);
    }
  }

  async getAll() {
    return await this.permissionRepository.getAll();
  }

  async getById(id: string) {
    await this.permissionValidator.checkPermissionExists(id);
    return await this.permissionRepository.getById(id);
  }

  async getByName(name: string) {
    return await this.permissionRepository.getByName(name);
  }

  async getByResource(resource: string) {
    return await this.permissionRepository.getByResource(resource);
  }

  async create(data) {
    await this.permissionValidator.checkPermissionNameUnique(data.name);
    return await this.permissionRepository.create(data);
  }

  async update(id: string, data) {
    await this.permissionValidator.checkPermissionExists(id);
    await this.permissionValidator.checkPermissionNameUnique(data.name, id);
    return await this.permissionRepository.update(id, data);
  }

  async delete(id: string) {
    await this.permissionValidator.checkPermissionExists(id);
    return await this.permissionRepository.delete(id);
  }

  async getPermissionsByRole(roleId: string) {
    return await this.permissionRepository.getPermissionsByRole(roleId);
  }

  async getRolesByPermission(permissionId: string) {
    await this.permissionValidator.checkPermissionExists(permissionId);
    return await this.permissionRepository.getRolesByPermission(permissionId);
  }

  async assignPermissionToRole(roleId: string, permissionId: string) {
    await this.permissionValidator.checkRoleHasPermission(roleId, permissionId);
    const assigned = await this.permissionRepository.assignPermissionToRole(roleId, permissionId);
    await this.invalidateRoleHolders(roleId);
    return assigned;
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    const removed = await this.permissionRepository.removePermissionFromRole(roleId, permissionId);
    await this.invalidateRoleHolders(roleId);
    return removed;
  }

  async seedDefaultPermissions(defaultPermissions) {
    const created = [];
    const skipped = [];

    for (const permission of defaultPermissions) {
      try {
        const entity = await this.create(permission);
        created.push(entity);
      } catch (error) {
        skipped.push({
          permission: permission.name,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { created, skipped };
  }

  async seedDefaultRolePermissions(defaultRolePermissions) {
    const assigned = [];
    const skipped = [];

    for (const { roleName, permissions } of defaultRolePermissions) {
      try {
        await this.permissionValidator.checkRoleExistsByName(roleName);
        const role = await this.roleService.getByName(roleName);

        for (const permissionName of permissions) {
          try {
            await this.permissionValidator.checkPermissionExistsByName(permissionName);
            const permission = await this.getByName(permissionName);

            await this.permissionValidator.checkRoleHasPermission(role.id, permission.id);

            await this.assignPermissionToRole(role.id, permission.id);
            assigned.push({ role: roleName, permission: permissionName });
          } catch (error) {
            skipped.push({
              role: roleName,
              permission: permissionName,
              reason: error instanceof Error ? error.message : String(error)
            });
          }
        }
      } catch (error) {
        skipped.push({
          role: roleName,
          permission: 'all',
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { assigned, skipped };
  }

  async deleteAll() {
    return await this.permissionRepository.deleteAll();
  }

}
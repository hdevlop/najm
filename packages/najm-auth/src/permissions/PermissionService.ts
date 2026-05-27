import { Injectable } from 'najm-core';
import { PermissionRepository } from './PermissionRepository';
import { PermissionValidator } from './PermissionValidator';
import { RoleService } from '../roles/RoleService';

@Injectable()
export class PermissionService {
  constructor(
    private permissionRepository: PermissionRepository,
    private permissionValidator: PermissionValidator,
    private roleService: RoleService
  ) { }

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
    return await this.permissionRepository.assignPermissionToRole(roleId, permissionId);
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    return await this.permissionRepository.removePermissionFromRole(roleId, permissionId);
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
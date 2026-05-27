import { Injectable } from 'najm-core';
import { I18n, type TFn } from 'najm-i18n';
import { Err } from 'najm-core';
import { RoleRepository } from './RoleRepository';
import { ROLES } from './constants';

/**
 * RoleValidator - Business validation for role operations
 * Handles database checks (unique, exists)
 * Schema validation is handled by DTOs in role.dto.ts
 */
@Injectable()
export class RoleValidator {
    @I18n("roles") private t!: TFn;

    constructor(
        private roleRepository: RoleRepository,
    ) { }

    /**
     * Check if role name is unique
     */
    async checkNameUnique(roleName: string, excludeId?: string) {
        if (!roleName) return;
        const existingRole = await this.roleRepository.getByName(roleName);

        if (existingRole && existingRole.id !== excludeId) {
            Err(this.t('errors.exists'), 409);
        }
    }

    /**
     * Check if role exists by ID
     */
    async checkRoleExists(id: string) {
        const role = await this.roleRepository.getById(id);
        if (!role) {
            Err(this.t('errors.notFound'), 404);
        }
        return role;
    }

    /**
     * Check if role exists by name
     */
    async checkRoleExistsByName(roleName: string) {
        const role = await this.roleRepository.getByName(roleName);
        if (!role) {
            Err(this.t('errors.notFound'), 404);
        }
        return role;
    }

    /**
     * Check if admin role exists (required for system setup)
     */
    async checkAdminRoleExists() {
        const adminRole = await this.roleRepository.getByName(ROLES.ADMIN);
        if (!adminRole) {
            Err(this.t('errors.adminRoleNotFound'), 500);
        }
        return adminRole;
    }

    /**
     * Check if role name exists (returns boolean, doesn't throw)
     */
    async isRoleNameExists(roleName: string): Promise<boolean> {
        const existingRole = await this.roleRepository.getByName(roleName);
        return !!existingRole;
    }
}
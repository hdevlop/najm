import { Injectable, Err } from 'najm-core';
import { I18n, type TFn } from 'najm-i18n';
import { RoleRepository } from './RoleRepository';
import { RoleValidator } from './RoleValidator';
import { ROLES } from './constants';

@Injectable()
export class RoleService {
  @I18n('roles') private t!: TFn;

  constructor(
    private roleRepository: RoleRepository,
    private roleValidator: RoleValidator
  ) { }

  async getAll() {
    return await this.roleRepository.getAll();
  }

  async getById(id) {
    await this.roleValidator.checkRoleExists(id);
    return await this.roleRepository.getById(id);
  }

  async getByName(name) {
    return await this.roleRepository.getByName(name);
  }

  async create(data) {
    await this.roleValidator.checkNameUnique(data.name);
    return await this.onDuplicateName(() => this.roleRepository.create(data));
  }

  async update(id: string, data: { name?: string; description?: string }) {
    const role = await this.roleValidator.checkRoleExists(id);
    // The built-in admin role is matched by literal name in isAdmin(); renaming
    // it would silently break every @isAdmin() guard and lock out administration.
    if (role.name === ROLES.ADMIN && data.name && data.name !== ROLES.ADMIN) {
      Err(this.t('errors.cannotRenameSystem'), 403);
    }
    await this.roleValidator.checkNameUnique(data.name, id);
    return await this.onDuplicateName(() => this.roleRepository.update(id, data));
  }

  async delete(id: string) {
    const role = await this.roleValidator.checkRoleExists(id);
    if (role.name === ROLES.ADMIN) {
      Err(this.t('errors.cannotDeleteSystem'), 403);
    }
    // users.roleId has no ON DELETE rule, so deleting a referenced role would
    // raise a raw FK violation (500). Fail cleanly with a 409 instead.
    if (await this.roleRepository.hasUsers(id)) {
      Err(this.t('errors.roleInUse'), 409);
    }
    return await this.roleRepository.delete(id);
  }

  async seedDefaultRoles(defaultRoles) {

    const rolesToCreate = [];

    for (const role of defaultRoles) {
      const exists = await this.roleValidator.isRoleNameExists(role.name);
      if (!exists) {
        rolesToCreate.push(role);
      }
    }

    const createdRoles = await Promise.all(
      rolesToCreate.map(role => this.roleRepository.create(role))
    );

    return createdRoles;
  }

  async getRoleIdByName(name) {
    const role = await this.getByName(name);
    return role?.id;
  }

  /**
   * checkNameUnique() reads before it writes, so two concurrent requests can
   * both pass it and race to insert the same name. The database rejects the
   * loser; answer it with the same 409 the validator would have given rather
   * than leaking a raw driver error as a 500.
   */
  private async onDuplicateName<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isDuplicateRoleName(error)) {
        Err(this.t('errors.exists'), 409);
      }
      throw error;
    }
  }
}

/** Unique-violation detection for both supported dialects. */
function isDuplicateRoleName(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as { code?: unknown; message?: unknown };
  // PostgreSQL unique_violation.
  if (candidate.code === '23505') return true;
  // SQLite.
  if (candidate.code === 'SQLITE_CONSTRAINT_UNIQUE') return true;

  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return /unique constraint failed/i.test(message)
    || /duplicate key value violates unique constraint/i.test(message);
}

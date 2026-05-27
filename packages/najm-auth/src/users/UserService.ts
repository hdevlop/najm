import { Injectable, Inject } from 'najm-core';
import { Transaction } from 'najm-database';
import { I18nService } from 'najm-i18n';
import { UserRepository } from './UserRepository';
import { UserValidator } from './UserValidator';
import { RoleService } from '../roles/RoleService';
import { RoleValidator } from '../roles/RoleValidator';
import { EncryptionService } from '../auth/EncryptionService';
import { nanoid } from 'nanoid';
import { clean } from '../shared';
import { Err } from 'najm-core';
import { AUTH_CONFIG } from '../auth.tokens';
import type { AuthConfig } from '../types';
import type { User } from '../schema/pg';

export type SanitizedUser = Omit<User, 'password' | 'failedLoginAttempts' | 'lockoutUntil'> & {
  role?: string | null;
  permissions?: string[];
};

@Injectable()
export class UserService {
  constructor(
    private roleValidator: RoleValidator,
    private roleService: RoleService,
    private userRepository: UserRepository,
    private userValidator: UserValidator,
    private encryptionService: EncryptionService,
    private i18nService: I18nService,
    @Inject(AUTH_CONFIG) private authConfig: AuthConfig,
  ) { }

  private sanitizeUser(user: any): SanitizedUser | undefined {
    if (!user) return user;
    const { password, failedLoginAttempts, lockoutUntil, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  private sanitizeUsers(users: any[]): SanitizedUser[] {
    return users.map(user => this.sanitizeUser(user)).filter(Boolean) as SanitizedUser[];
  }

  private async resolveUserRole(roleId?: string, roleName?: string): Promise<string | null> {

    if (roleId) {
      await this.roleValidator.checkRoleExists(roleId);
      return roleId;
    }

    if (roleName) {
      const roleByName = await this.roleService.getByName(roleName);
      if (roleByName) {
        return roleByName.id;
      }
      Err(`Role '${roleName}' not found`);
    }

    // Use configured default role (e.g., 'user') or null if not configured
    if (this.authConfig.defaultRole) {
      const defaultRole = await this.roleService.getByName(this.authConfig.defaultRole);
      if (!defaultRole) {
        Err(`Default role '${this.authConfig.defaultRole}' not found. Create it first or set defaultRole to null in auth config.`);
      }
      return defaultRole.id;
    }

    // No default role configured - user registered without a role
    return null;
  }

  async getAll(): Promise<SanitizedUser[]> {
    const users = await this.userRepository.getAll();
    return this.sanitizeUsers(users);
  }

  async getById(id: string): Promise<SanitizedUser> {
    await this.userValidator.checkUserExists(id);
    const user = await this.userRepository.getById(id);
    return this.sanitizeUser(user) as SanitizedUser;
  }

  async getByEmail(email: string): Promise<SanitizedUser> {
    const user = await this.userValidator.checkUserExistsByEmail(email);
    return this.sanitizeUser(user) as SanitizedUser;
  }

  /**
   * Find user by email without throwing - returns null if not found
   * Used for timing-safe authentication
   */
  async findByEmail(email: string): Promise<(User & { role?: string | null }) | undefined> {
    return await this.userRepository.getByEmail(email);
  }

  async getAuthRecordById(id: string): Promise<User | undefined> {
    return await this.userRepository.getRawById(id);
  }

  @Transaction()
  async create(data: Record<string, any>): Promise<SanitizedUser> {
    const { id, email, name, image, emailVerified, password, roleId, role } = data;

    // Require explicit password - no defaults
    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      Err('Password is required');
    }

    // Validate password strength
    this.userValidator.validatePasswordStrength(password);

    let userId = id || nanoid(5);

    await this.userValidator.checkEmailUnique(data.email);
    await this.userValidator.checkUserIdIsUnique(id);

    const hashedPassword = await this.encryptionService.hashPassword(password);
    const resolvedRoleId = await this.resolveUserRole(roleId, role);

    const userDetails = {
      id: userId,
      name: name || null,
      email,
      image,
      password: hashedPassword,
      roleId: resolvedRoleId,
      emailVerified,
      status: (data.status as 'active' | 'inactive' | 'pending') ?? this.authConfig.registrationMode ?? 'active',
    };

    const newUser = await this.userRepository.create(userDetails);

    return this.sanitizeUser(newUser);


  }

  async update(id: string, data: Record<string, any>): Promise<SanitizedUser> {
    const { password, image } = data;

    await this.userValidator.checkUserExists(id);
    await this.userValidator.checkEmailUnique(data.email, id);

    // Validate password strength if being updated
    let hashedPassword: string | undefined;
    if (password) {
      this.userValidator.validatePasswordStrength(password);
      hashedPassword = await this.encryptionService.hashPassword(password);
    }

    const updateData = {
      ...data,
      image,
      ...(hashedPassword && { password: hashedPassword })
    };

    const cleanedUpdateData = clean(updateData);
    const updatedUser = await this.userRepository.update(id, cleanedUpdateData);
    return this.sanitizeUser(updatedUser) as SanitizedUser;
  }

  async delete(id: string): Promise<SanitizedUser> {
    await this.userValidator.checkUserExists(id);
    const user = await this.userRepository.delete(id);
    return this.sanitizeUser(user) as SanitizedUser;
  }

  async deleteAll(): Promise<SanitizedUser[]> {
    const deletedUsers = await this.userRepository.deleteAll();
    return this.sanitizeUsers(deletedUsers);
  }

  async getRoleName(id: string): Promise<string | null> {
    await this.userValidator.checkUserExists(id);
    return await this.userRepository.getRoleNameById(id);
  }

  async getPassword(email: string): Promise<string | undefined> {
    await this.userValidator.checkUserExistsByEmail(email);
    return await this.userRepository.getUserPassword(email);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userValidator.checkUserExists(id);
    await this.userRepository.updateLastLogin(id);
  }

  async incrementFailedAttempts(id: string): Promise<number> {
    const user = await this.userRepository.incrementFailedAttempts(id);
    return user.failedLoginAttempts ?? 0;
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await this.userRepository.resetFailedAttempts(id);
  }

  async setLockout(id: string, until: string): Promise<void> {
    await this.userRepository.setLockout(id, until);
  }

  async assignRole(id: string, roleId?: string, roleName?: string): Promise<SanitizedUser> {
    await this.userValidator.checkUserExists(id);
    const resolvedRoleId = await this.resolveUserRole(roleId, roleName);
    const updatedUser = await this.userRepository.update(id, { roleId: resolvedRoleId });
    return this.sanitizeUser(updatedUser) as SanitizedUser;
  }

  async removeRole(id: string): Promise<SanitizedUser> {
    await this.userValidator.checkUserExists(id);
    const updatedUser = await this.userRepository.update(id, { roleId: null });
    return this.sanitizeUser(updatedUser) as SanitizedUser;
  }

  async seedAdminUser(config?: { email?: string; password?: string; name?: string }): Promise<SanitizedUser> {
    // Require credentials to be passed, never hardcode
    if (!config?.email || !config?.password) {
      Err('Admin email and password must be provided via config parameter');
    }

    // Enforce strong password for admin
    if (config.password.length < 12) {
      Err('Admin password must be at least 12 characters');
    }

    const adminRole = await this.roleValidator.checkAdminRoleExists();
    const existingUser = await this.userRepository.getByEmail(config.email);

    if (existingUser) {
      await this.delete(existingUser.id);
    }

    const newAdminUser = await this.create({
      id: nanoid(10), // Random ID instead of predictable 'USR00'
      name: config.name || 'System Administrator',
      email: config.email,
      password: config.password,
      image: null,
      roleId: adminRole.id,
      status: 'active',
      emailVerified: true
    });

    return this.sanitizeUser(newAdminUser) as SanitizedUser;
  }

  async updateLang(language: string): Promise<string> {
    this.i18nService.setLanguage(language)
    return language
  }

  async getLang(): Promise<string> {
    return this.i18nService.getCurrentLanguage();
  }

}

import { Injectable } from 'najm-core';
import { Err } from 'najm-core';
import { I18n, type TFn } from 'najm-i18n';
import { UserRepository } from './UserRepository';
import { EncryptionService } from '../auth/EncryptionService';

/**
 * UserValidator - Business validation for user operations
 * Handles database checks (unique, exists, permissions)
 * Schema validation is handled by DTOs in user.dto.ts
 */
@Injectable()
export class UserValidator {
   @I18n("users") private t!: TFn;

   constructor(
      private userRepository: UserRepository,
      private encryptionService: EncryptionService,
   ) { }

   /**
    * Check if email already exists in database
    */
   async checkEmailUnique(email: string, excludeId?: string) {
      if (!email) return;
      const existingUser = await this.userRepository.getByEmail(email);
      if (existingUser && existingUser.id !== excludeId) {
         Err(this.t('errors.emailExists'), 409);
      }
   }

   /**
    * Check if user exists by ID
    */
   async checkUserExists(id: string) {
      const user = await this.userRepository.getById(id);
      if (!user) {
         Err(this.t('errors.notFound'), 404);
      }
      return user;
   }

   /**
    * Check if user exists by email
    */
   async checkUserExistsByEmail(email: string) {
      const user = await this.userRepository.getByEmail(email);
      if (!user) {
         Err(this.t('errors.invalidCredentials'), 401);
      }
      return user;
   }

   /**
    * Check if email exists in database
    */
   async checkEmailExists(email: string) {
      const user = await this.userRepository.getByEmail(email);
      if (!user) {
         Err(this.t('errors.notFound'), 404);
      }
      return user;
   }

   /**
    * Verify password against hashed password (throws on invalid)
    */
   async checkPasswordValid(password: string, hashedPassword: string) {
      const isPasswordValid = await this.encryptionService.comparePassword(password, hashedPassword);
      if (!isPasswordValid) {
         Err(this.t('auth.errors.invalidCredentials'), 401);
      }
   }

   /**
    * Compare password against hash - returns boolean (no throw)
    * Used for timing-safe authentication
    */
   async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
      return await this.encryptionService.comparePassword(password, hashedPassword);
   }

   /**
    * Check if user ID is unique (for custom IDs)
    */
   async checkUserIdIsUnique(id: string) {
      if (!id) return;
      const existingUser = await this.userRepository.getById(id);
      if (existingUser) {
         Err(this.t('errors.idExists'), 409);
      }
   }

   /**
    * Check if user has required role
    */
   async hasRole(userId: string, roles: string[]) {
      const roleName = await this.userRepository.getRoleNameById(userId);

      if (!roleName) {
         Err(this.t('errors.accessDenied'), 403);
      }

      const hasRole = roles.some(
         item => roleName.toLowerCase() === item.toLowerCase()
      );

      if (!hasRole) {
         Err(this.t('errors.accessDenied'), 403);
      }

      return true;
   }

   /**
    * Validate password strength and complexity
    * Enforces:
    * - Minimum 8 characters
    * - At least one uppercase letter
    * - At least one lowercase letter
    * - At least one number
    */
   validatePasswordStrength(password: string): void {
      if (!password) {
         Err('Password is required', 400);
      }

      const minLength = 8;
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasNumber = /\d/.test(password);

      if (password.length < minLength) {
         Err(`Password must be at least ${minLength} characters long`, 400);
      }

      if (!hasUppercase) {
         Err('Password must contain at least one uppercase letter', 400);
      }

      if (!hasLowercase) {
         Err('Password must contain at least one lowercase letter', 400);
      }

      if (!hasNumber) {
         Err('Password must contain at least one number', 400);
      }
   }

}
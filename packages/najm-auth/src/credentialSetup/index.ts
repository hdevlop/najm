import { CredentialSetupController } from './CredentialSetupController';
import { CredentialSetupRepository } from './CredentialSetupRepository';
import { CredentialSetupRequirementRepository } from './CredentialSetupRequirementRepository';
import { CredentialSetupRequirementService } from './CredentialSetupRequirementService';
import { CredentialSetupService } from './CredentialSetupService';
import { PasswordSetupService } from './PasswordSetupService';

export * from './CredentialSetupController';
export * from './CredentialSetupDto';
export * from './CredentialSetupRepository';
export * from './CredentialSetupRequirementRepository';
export * from './CredentialSetupRequirementService';
export * from './CredentialSetupService';
export * from './PasswordSetupService';
export * from './errors';
export * from './purpose';
export * from './types';

export const CREDENTIAL_SETUP_MODULE = [
  CredentialSetupRepository,
  CredentialSetupRequirementRepository,
  CredentialSetupService,
  CredentialSetupRequirementService,
  PasswordSetupService,
  CredentialSetupController,
] as const;

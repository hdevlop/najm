import { CredentialSetupRepository } from './CredentialSetupRepository';
import { CredentialSetupService } from './CredentialSetupService';

export * from './CredentialSetupRepository';
export * from './CredentialSetupService';
export * from './types';

export const CREDENTIAL_SETUP_MODULE = [
  CredentialSetupRepository,
  CredentialSetupService,
] as const;

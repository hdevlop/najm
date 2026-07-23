// Core types
export type {
   GuardMetadata,
   CreateGuardOptions,
   GuardPluginConfig,
   GuardResult,
   GuardReturnType,
   CompositeGuardParams
} from './types';

// ALS Tokens for guard context
export {
   USER,
   OWNER,
   INFO,
   DATA,
   FILTER,
   ROLE,
   PERMISSIONS,
   GUARD_PARAMS,
   GUARDS_META,
   GUARD_CONFIG
} from './tokens';

// Decorator API
export {
   createGuard,
   composeGuards,
   getGuardMetadata,
   hasGuards
} from './decorator';

// Plugin registration
export * from './GuardPlugin';

// Shared guard runner (used by GuardService and McpBuilderService)
export { runGuards, applyGuardResult } from './guardRunner';

// Service
export { GuardService } from './GuardService';

// Errors
export { GuardError, GUARD_CODES } from 'najm-core';

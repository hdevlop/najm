// ============================================================================
// DEPRECATED: This file is kept for backward compatibility only
// Please import from the new centralized schema files:
// - import { baseFields, userStatusEnum, ... } from 'najm-auth/pg'
// - import { baseFields, ... } from 'najm-auth/sqlite'
// - import { USER_STATUS, TOKEN_STATUS, TOKEN_TYPE } from 'najm-auth/schema/constants'
// ============================================================================

// Re-export from centralized schema (PostgreSQL by default)
export { baseFields, userStatusEnum, tokenStatusEnum, tokenTypeEnum } from '../schema/pg';

// Re-export constants
export { USER_STATUS, TOKEN_STATUS, TOKEN_TYPE } from '../schema/constants';

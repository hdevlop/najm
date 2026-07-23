// Default schema export (PostgreSQL for backward compatibility)
// Users can import dialect-specific schemas via:
// - import { authSchema } from 'najm-auth/pg'
// - import { authSchema } from 'najm-auth/sqlite'

export * from './pg';
export * from './constants';

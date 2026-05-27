// ============================================================================
// DatabasePlugin.ts - Database Plugin Factory (Fluent API)
// ============================================================================

import { plugin } from 'najm-core';
import { DatabaseService } from './DatabaseService';
import { TransactionService } from './TransactionService';
import { SeedService } from './SeedService';
import { DATABASE_CONFIG } from './tokens';
import type { DatabaseConfig } from './types';

export const database = (config?: DatabaseConfig) =>
   plugin('database')
      .services(DatabaseService, TransactionService, SeedService)
      .config(DATABASE_CONFIG, config ?? {})
      .build();

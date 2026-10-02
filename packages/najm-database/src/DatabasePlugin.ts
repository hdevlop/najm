// ============================================================================
// DatabasePlugin.ts - Database Plugin Factory (Fluent API)
// ============================================================================

import { Err, plugin } from 'najm-core';
import { DatabaseService } from './DatabaseService';
import { TransactionService } from './TransactionService';
import { SeedService } from './SeedService';
import { DATABASE_CONFIG, DATABASE_OPTIONS } from './tokens';
import type { DatabaseConfig, DatabasePluginOptions } from './types';

export const database = (config?: DatabaseConfig, options?: DatabasePluginOptions) => {
   let connections = config ?? {};
   let inlineOptions: DatabasePluginOptions = {};
   if (connections && typeof connections === 'object' && !('$client' in connections) && Object.hasOwn(connections, 'close')) {
      const { close, ...namedConnections } = connections;
      // A connection map can include options. A raw client with a close()
      // method, or a connection named "close", remains a database.
      if (typeof close !== 'object' && Object.values(namedConnections).every(value => value !== null && typeof value === 'object')) {
         connections = namedConnections;
         inlineOptions = { close };
      }
   }
   const resolvedOptions = { ...inlineOptions, ...options };
   if (resolvedOptions.close !== undefined && typeof resolvedOptions.close !== 'boolean' && typeof resolvedOptions.close !== 'function') {
      throw Err.invalidConfig('database', 'close must be a boolean or a function');
   }
   return plugin('database')
      .services(DatabaseService, TransactionService, SeedService)
      .config(DATABASE_CONFIG, connections)
      .set(DATABASE_OPTIONS, resolvedOptions)
      .build();
};

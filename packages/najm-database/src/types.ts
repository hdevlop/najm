// ============================================================================
// types.ts - Database Types
// ============================================================================

import type { InjectionDefinition } from 'najm-core';

// ============================================
// TRANSACTION TYPES
// ============================================

export type IsolationLevel =
   | 'read uncommitted'
   | 'read committed'
   | 'repeatable read'
   | 'serializable';

export interface TransactionalOptions {
   /** Database name to use (default: 'default') */
   database?: string;
   /** Number of retry attempts on deadlock/serialization failures */
   retries?: number;
   /** Transaction isolation level */
   isolation?: IsolationLevel;
   /** Transaction timeout in milliseconds */
   timeout?: number;
}

// ============================================
// DATABASE TYPES
// ============================================

export interface Database {
   query?: (...args: any[]) => Promise<any>;
   execute?: (...args: any[]) => Promise<any>;
   transaction?: (...args: any[]) => Promise<any>;
   connect?: () => Promise<void>;
   disconnect?: () => Promise<void>;
   $client?: any;
   prepare?: (...args: any[]) => any;
   raw?: (...args: any[]) => any;
   get?: (...args: any[]) => any;
   set?: (...args: any[]) => any;
}

export type DbClient<T = any> = T;
export type TDb<T = any> = T;
export type DatabaseConfig =  any;

export interface DatabasePluginOptions {
   /**
    * What happens to the connections when the server stops.
    *
    * - `true` (default): each supported client is closed once, through its database's
    *   `disconnect()`, or else the driver client behind drizzle's `$client`
    *   (`end()` for postgres-js and node-postgres, `close()` for SQLite).
    * - `false`: keep pools open when shared with other servers or tests.
    * - a function: called once per distinct client instead of automatic close.
    *   Receives the first registered name in alphabetical order and its database.
    *
    * All closes are attempted before a failure is reported by stop(). For
    * driver-specific timeouts or drivers without a recognized close method,
    * supply a callback. Those drivers are left open by automatic cleanup.
    * Named connection maps accept this option inline:
    * `database({ default: db, close: false })`.
    */
   close?: boolean | ((db: any, name: string) => unknown);
}

// ============================================================================
// DATABASE INJECTION TYPES
// ============================================================================

/**
 * Database injection for @DB decorator
 * Registers database connection injection for properties
 */
export interface DatabaseInjection extends InjectionDefinition {
   type: 'database';
   target: any;
   propertyKey: string | symbol;
   databaseName: string;
}

/**
 * Transaction injection for @Transaction decorator
 * Registers method-level transaction handling
 */
export interface TransactionInjection extends InjectionDefinition {
   type: 'transaction';
   target: any;
   propertyKey: string | symbol;
   options: TransactionalOptions;
}

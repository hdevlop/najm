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
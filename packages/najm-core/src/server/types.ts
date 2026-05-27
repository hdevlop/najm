// Server Root Types - Main SERVER_OPTS
import { Hono, MiddlewareHandler } from 'hono';
import type { LoggerConfig } from '../logging/types';
import { Token } from 'diject';
import type { PluginContribution } from './plugin';

// ============================================================================
// SERVER OPTIONS
// ============================================================================

export abstract class ServerOpts {
   app?: Hono;
   port?: number | string = 3000;
   middleware?: MiddlewareHandler[] = [];
   controllers?: Constructor[] = [];
   providers?: Constructor[] = [];
   basePath?: string = '';
   serverless?: boolean = false;
   databases?: Record<string, any>;
   silent?: boolean = false;
   logger?: LoggerConfig;
   isolated?: boolean;
}

export type Constructor<T = any> = new (...args: any[]) => T;

/** Accepted by server.load(): a class, an array of classes, or a module namespace */
export type Loadable = Constructor | readonly Constructor[] | Record<string, unknown>;

/** Accepted by server.scan(): a folder path (or paths), or import.meta.glob eager output */
export type ScanTarget =
   | string
   | readonly string[]
   | Record<string, Record<string, unknown>>;

/**
 * Plugin configuration
 */
export interface NajmPlugin {
   /** Plugin name */
   name: string;

   /** Plugin version (optional) */
   version?: string;

   /** Services to register */
   services?: Constructor[];

   /** Token to inject config */
   token?: Token;

   /** Config value for token */
   config?: any;

   /** Multiple tokens to inject */
   tokens?: Array<[Token, any]>;

   /** Dependencies: NajmPlugin = auto-register, string = required */
   dependencies?: (NajmPlugin | string)[];

   /** Token-to-constructor aliases */
   aliases?: Array<[Token, Constructor]>;

   /** Contributions to other plugins (accumulated as arrays) */
   contributions?: PluginContribution[];
}

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
   diagnostics?: boolean;
   gracefulShutdown?: boolean;
   /**
    * Max time (ms) to wait for in-flight requests to finish during `stop()`
    * after the listener stops accepting new connections. Enables drain
    * tracking on its own (independent of `gracefulShutdown` signal handlers).
    * Default when draining: 10000.
    */
   shutdownTimeout?: number;
   requestLogging?: boolean;
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

   /**
    * Dependencies: NajmPlugin = auto-register, LazyDependency = auto-register
    * built only when needed, string = required
    */
   dependencies?: (NajmPlugin | LazyDependency | string)[];

   /** Token-to-constructor aliases */
   aliases?: Array<[Token, Constructor]>;

   /** Contributions to other plugins (accumulated as arrays) */
   contributions?: PluginContribution[];
}

/**
 * A dependency registered under `name` only when no plugin of that name is
 * registered yet. Unlike a plain plugin dependency, `create()` is not called
 * when the name is already taken, so building the plugin (and validating its
 * config) happens only for the plugin that is actually used.
 */
export interface LazyDependency {
   /** Name of the plugin `create()` returns. */
   readonly name: string;

   /** Builds the plugin. Called at most once, during registration. */
   readonly create: () => NajmPlugin;

   /**
    * Names the config the dependent plugin received for this dependency, e.g.
    * `'auth({ cache })'`. When `name` is already registered that config is not
    * used, and the server warns once at startup naming it.
    */
   readonly forwardedConfig?: string;
}

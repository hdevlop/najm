// ============================================================================
// Server.ts - Clean plugin approach with opt-in features
// ============================================================================

import { Hono, MiddlewareHandler } from 'hono';
import { createLogger, LoggerService } from '../logging/LoggerService';
import { BootService } from '../boot/BootService';
import { Err } from '../errors';
import type { NajmPlugin, Constructor, ServerOpts, Loadable, ScanTarget } from './types';
import {
   container,
   Container,
   isInjectable,
} from 'diject';
import { ScannerService } from '../scanner';
import { router } from '../router';
import { params } from '../params';
import { middleware } from '../middleware';
import { APP, BASE_PATH, SERVER_OPTS, LOGGER } from './tokens';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Re-export plugin builder
export { plugin, type ContributionToken, type PluginContribution } from './plugin';
export { handle } from './handle';

const CORE_SERVICES = [BootService, LoggerService, ScannerService];

const enum ServerState {
   IDLE = 'idle',
   INITIALIZING = 'initializing',
   READY = 'ready',
   FAILED = 'failed',
}

export class Server {
   public readonly container: Container;
   public readonly app: Hono;

   private readonly opts: ServerOpts = {};
   private logger: LoggerService = createLogger();
   private readonly plugins = new Map<string, NajmPlugin>();
   private readonly contributions = new Map<symbol, unknown[]>();
   private readonly registeredContributions = new Set<string>();
   private readonly middlewareHandlers: MiddlewareHandler[] = [];
   private readonly scanRoots = new Set<string>();
   private readonly startupLogs: unknown[][] = [];

   private server?: ReturnType<typeof Bun.serve>;
   private initPromise?: Promise<void>;
   private initError?: unknown;
   private _fetchHandler?: (req: Request) => Promise<Response>;
   private appServices: Constructor[] = [];
   public basePath = '';
   private state: ServerState = ServerState.IDLE;

   constructor(opts: ServerOpts = {}) {
      this.app = opts.app ?? new Hono({ strict: false });
      this.opts = { ...opts, app: this.app };
      this.container = opts.isolated ? new Container() : container;

      this.app.onError((error, c) => {
         return Err.handle(error);
      });
   }

   // ============================================================================
   // FLUENT API
   // ============================================================================

   public base(path: string): this {
      this.basePath = this.normalizePath(path);
      return this;
   }

   public set<K extends keyof ServerOpts>(key: K, value: ServerOpts[K]): this {
      this.opts[key] = value;
      return this;
   }

   public log(...messages: unknown[]): this {
      if (!messages.length) {
         return this;
      }

      const entry = messages.length === 1 && Array.isArray(messages[0])
         ? messages[0] as unknown[]
         : messages;

      if (this.state === ServerState.READY) {
         this.logger.info(this.stringifyLogEntry(entry));
         return this;
      }

      this.startupLogs.push(entry);
      return this;
   }

   public use(plugin: NajmPlugin): this {
      this.registerPlugin(plugin, new Set());
      return this;
   }

   public middleware(...handlers: MiddlewareHandler[]): this {
      this.middlewareHandlers.push(...handlers);
      return this;
   }

   public load(...items: Loadable[]): this {
      for (const item of items) {
         if (typeof item === 'function') {
            this.appServices.push(item as Constructor);
            continue;
         } else if (Array.isArray(item)) {
            for (const ctor of item) {
               this.appServices.push(ctor as Constructor);
            }
            continue;
         }

         if (typeof item === 'object' && item !== null) {
            this.addInjectablesFromModule(item as Record<string, unknown>);
         }
      }
      return this;
   }

   public scan(target: ScanTarget = './src/features'): this {
      if (typeof target === 'string' || Array.isArray(target)) {
         const roots = Array.isArray(target) ? target : [target];

         for (const root of roots) {
            const normalized = root.trim();
            if (normalized) {
               this.scanRoots.add(normalized);
            }
         }

         return this;
      }

      for (const mod of Object.values(target)) {
         if (mod && typeof mod === 'object') {
            this.addInjectablesFromModule(mod as Record<string, unknown>);
         }
      }

      return this;
   }

   // ============================================================================
   // SERVER LIFECYCLE
   // ============================================================================

   public async listen(portOrCb?: number | string | (() => void), cb?: () => void): Promise<this> {
      const rawPort = typeof portOrCb === 'function' || portOrCb === undefined
         ? this.opts.port
         : portOrCb;
      const port = this.normalizePort(rawPort);
      const callback = typeof portOrCb === 'function' ? portOrCb : cb;

      this.opts.port = port;
      await this.ensureInitialized();

      try {
         this.server = Bun.serve({
            fetch: async (req) => {
               try {
                  return await this.app.fetch(req);
               } catch (error) {
                  if (!this.opts.silent) {
                     this.logger.serverError(error);
                  }
                  return Err.handle(error);
               }
            },
            port,
         });
      } catch (error) {
         if (!this.opts.silent) {
            this.logger.serverError(error);
         }
         throw Err.startFailed(port, error);
      }

      this.logger.serverStarted(this.server.port);
      this.logDevModeStartup(this.server.port);
      this.flushStartupLogs();

      callback?.();
      return this;
   }

   public async init(): Promise<this> {
      await this.ensureInitialized();
      this.flushStartupLogs();
      return this;
   }

   public async runAs<T>(
      user: { id: string; role: string; permissions?: string[] },
      fn: () => Promise<T> | T,
   ): Promise<T> {
      await this.ensureInitialized();

      const requestId = `runAs:${randomUUID()}`;
      const store: Record<string, unknown> = {
         requestId,
         user,
         role: user.role,
      };

      if (user.permissions !== undefined) {
         store.permissions = user.permissions;
      }

      return await this.container.run(store, async () => {
         try {
            return await fn();
         } finally {
            await this.container.cleanupReq(requestId);
         }
      });
   }

   public get fetch(): (req: Request) => Promise<Response> {
      return (this._fetchHandler ??= async (req) => {
         await this.ensureInitialized();
         return this.app.fetch(req);
      });
   }

   public async stop(): Promise<void> {
      if (!this.server) return;

      try {
         // Run onDestroy lifecycle on all services (reverse boot order)
         try {
            const bootService = this.container.get(BootService);
            if (bootService) await bootService.destroy();
         } catch {
            // BootService may not be resolved yet if stop() called early
         }

         this.server.stop?.();
         this.server = undefined;
         this.state = ServerState.IDLE;
         this.initPromise = undefined;
         this.logger.serverStopped();
      } catch {
         throw Err.stopFailed();
      }
   }

   public get isRunning(): boolean {
      return !!this.server;
   }

   public get port(): number | undefined {
      return this.server?.port;
   }

   // ============================================================================
   // INITIALIZATION
   // ============================================================================

   private async ensureInitialized(): Promise<void> {
      if (this.state === ServerState.READY) return;
      if (this.state === ServerState.FAILED) {
         throw Err.startFailed(this.resolvePortForErrors(), this.initError);
      }

      return (this.initPromise ??= this.initialize());
   }

   private async initialize(): Promise<void> {
      this.state = ServerState.INITIALIZING;
      this.initError = undefined;

      if (!this.opts.silent) {
         this.logger.serverInitializing();
      }

      try {
         this.registerDefaultPlugins();
         this.mergeMiddlewareHandlers();
         await this.resolveScanRoots();

         const pluginServices = this.collectPluginServices();

         this.container
            .set(SERVER_OPTS, this.opts)
            .set(APP, this.app)
            .set(BASE_PATH, this.basePath)
            .set(CORE_SERVICES)
            .alias(LOGGER, LoggerService)
            .set(pluginServices)
            .set(this.appServices, { metadata: { layer: 'app' } });

         const bootService = await this.container.resolve(BootService);
         await bootService.boot();

         // Ensure every plugin alias target is materialised. With diject ^0.1.5,
         // alias() registers a transparent forwarder — get(token) follows to the
         // target — so this only needs to instantiate any target that wasn't part
         // of the booted service set.
         for (const plugin of this.plugins.values()) {
            if (plugin.aliases) {
               for (const [, target] of plugin.aliases) {
                  try {
                     await this.container.resolve(target);
                  } catch (err) {
                     console.error('[Server] alias target resolve failed for', target?.name, ':', err);
                  }
               }
            }
         }

         this.logger = await this.container.resolve(LoggerService);

         this.state = ServerState.READY;
         this.initError = undefined;
         this.logger.serverInitialized();
      } catch (error) {
         if (!this.opts.silent) {
            this.logger.serverError(error);
         }
         this.state = ServerState.FAILED;
         this.initPromise = undefined;
         this.initError = error;
         throw Err.startFailed(this.resolvePortForErrors(), error);
      }
   }

   // ============================================================================
   // PLUGIN MANAGEMENT
   // ============================================================================

   /**
    * Register a plugin with circular dependency detection
    */
   private registerPlugin(plugin: NajmPlugin, stack: Set<string>): void {
      // Circular dependency detection
      if (stack.has(plugin.name)) {
         throw Err.circularDependency([...stack, plugin.name]);
      }

      // Already registered - just merge tokens
      if (this.plugins.has(plugin.name)) {
         this.mergePluginTokens(plugin);
         return;
      }

      // Add to stack for cycle detection
      stack.add(plugin.name);

      // Register dependencies first
      this.registerDependencies(plugin, stack);

      // Accumulate contributions (only once per plugin)
      this.accumulateContributions(plugin);

      // Register plugin
      this.plugins.set(plugin.name, plugin);

      // Remove from stack
      stack.delete(plugin.name);
   }

   /**
    * Register plugin dependencies
    */
   private registerDependencies(plugin: NajmPlugin, stack: Set<string>): void {
      if (!plugin.dependencies?.length) return;

      for (const dep of plugin.dependencies) {
         if (typeof dep === 'string') {
            // String = required dependency
            if (!this.plugins.has(dep)) {
               throw Err.missingDependency(plugin.name, dep);
            }
            continue;
         }

         // NajmPlugin = auto-register
         if (!this.plugins.has(dep.name)) {
            this.registerPlugin(dep, stack);
         }
      }
   }

   /**
    * Accumulate contributions (only once per plugin)
    */
   private accumulateContributions(plugin: NajmPlugin): void {
      if (!plugin.contributions?.length) return;
      if (this.registeredContributions.has(plugin.name)) return;

      for (const { token, value } of plugin.contributions) {
         const existing = this.contributions.get(token) ?? [];
         existing.push(value);
         this.contributions.set(token, existing);
      }

      this.registeredContributions.add(plugin.name);
   }

   private mergePluginTokens(plugin: NajmPlugin): void {
      if (!plugin.tokens?.length) return;

      const existing = this.plugins.get(plugin.name);
      if (!existing) return;

      existing.tokens = [...(existing.tokens || []), ...plugin.tokens];
   }

   private registerDefaultPlugins(): void {
      const stack = new Set<string>();

      if (!this.plugins.has('middleware')) {
         this.registerPlugin(middleware(), stack);
      }

      if (!this.plugins.has('params')) {
         this.registerPlugin(params(), stack);
      }

      if (!this.plugins.has('router')) {
         this.registerPlugin(router(), stack);
      }
   }

   private mergeMiddlewareHandlers(): void {
      if (!this.middlewareHandlers.length) return;

      const plugin = this.plugins.get('middleware');
      if (!plugin) return;

      const existingHandlers = plugin.config?.use || [];
      plugin.config = {
         ...plugin.config,
         use: [...existingHandlers, ...this.middlewareHandlers],
      };
   }

   private collectPluginServices(): Constructor[] {
      const services: Constructor[] = [];

      for (const plugin of this.plugins.values()) {
         if (plugin.services?.length) {
            for (const service of plugin.services) {
               services.push(service);
            }
         }

         if (plugin.token && plugin.config !== undefined) {
            this.container.set(plugin.token, plugin.config);
         }

         if (plugin.tokens?.length) {
            for (const [token, value] of plugin.tokens) {
               this.container.set(token, value);
            }
         }

         if (plugin.aliases?.length) {
            for (const [token, target] of plugin.aliases) {
               this.container.alias(token, target);
            }
         }
      }

      // Set accumulated contributions
      for (const [token, values] of this.contributions) {
         this.container.set(token, values);
      }

      return services;
   }

   // ============================================================================
   // HELPERS
   // ============================================================================

   private addInjectablesFromModule(moduleExports: Record<string, unknown>): void {
      for (const exported of Object.values(moduleExports)) {
         if (typeof exported === 'function' && isInjectable(exported)) {
            this.appServices.push(exported as Constructor);
         }
      }
   }

   private async resolveScanRoots(): Promise<void> {
      if (!this.scanRoots.size) return;

      for (const root of this.scanRoots) {
         const absoluteRoot = this.resolveScanRoot(root);
         const barrels = this.collectBarrelEntries(absoluteRoot);

         for (const barrel of barrels) {
            const mod = await import(/* webpackIgnore: true */ pathToFileURL(barrel).href);
            this.addInjectablesFromModule(mod as Record<string, unknown>);
         }
      }
   }

   private resolveScanRoot(root: string): string {
      const absoluteRoot = isAbsolute(root) ? root : resolve(process.cwd(), root);

      if (!existsSync(absoluteRoot)) {
         throw new Error(`[najm] scan root does not exist: ${root}`);
      }

      if (!statSync(absoluteRoot).isDirectory()) {
         throw new Error(`[najm] scan root must be a directory: ${root}`);
      }

      return absoluteRoot;
   }

   private collectBarrelEntries(root: string): string[] {
      const barrels: string[] = [];
      const queue: string[] = [root];

      while (queue.length) {
         const current = queue.pop();
         if (!current) continue;

         for (const entry of readdirSync(current, { withFileTypes: true })) {
            const fullPath = join(current, entry.name);

            if (entry.isDirectory()) {
               queue.push(fullPath);
               continue;
            }

            if (entry.isFile() && this.isBarrelEntry(entry.name)) {
               barrels.push(fullPath);
            }
         }
      }

      barrels.sort();
      return barrels;
   }

   private isBarrelEntry(fileName: string): boolean {
      return /^index\.(ts|tsx|js|mjs|cjs|mts|cts)$/.test(fileName);
   }

   private normalizePath(path: string): string {
      return path.replace(/\/+$/, '').replace(/^(?!\/)/, '/');
   }

   private normalizePort(rawPort: ServerOpts['port']): number {
      if (rawPort === undefined || rawPort === null || rawPort === '') {
         return 3000;
      }

      if (typeof rawPort === 'number') {
         if (this.isValidPort(rawPort)) {
            return rawPort;
         }

         Err.invalidConfig('port', 'must be an integer between 0 and 65535');
      }

      if (typeof rawPort !== 'string') {
         Err.invalidConfig('port', `must be a number or numeric string, received "${String(rawPort)}"`);
      }

      const portString = rawPort as string;
      const trimmed = portString.trim();
      if (!trimmed) {
         return 3000;
      }

      if (!/^\d+$/.test(trimmed)) {
         Err.invalidConfig('port', `must be a numeric string, received "${rawPort}"`);
      }

      const port = Number.parseInt(trimmed, 10);
      if (!this.isValidPort(port)) {
         Err.invalidConfig('port', 'must be an integer between 0 and 65535');
      }

      return port;
   }

   private isValidPort(port: number): boolean {
      return Number.isInteger(port) && port >= 0 && port <= 65535;
   }

   private resolvePortForErrors(): number {
      try {
         return this.normalizePort(this.opts.port);
      } catch {
         return 3000;
      }
   }

   private flushStartupLogs(): void {
      if (!this.startupLogs.length) {
         return;
      }

      const entries = this.startupLogs.splice(0);

      for (const entry of entries) {
         this.logger.info(this.stringifyLogEntry(entry));
      }
   }

   private stringifyLogEntry(values: unknown[]): string {
      return values.map((value) => this.stringifyLogValue(value)).join(' ');
   }

   private stringifyLogValue(value: unknown): string {
      if (typeof value === 'string') {
         return value;
      }

      if (value === null) {
         return 'null';
      }

      if (value === undefined) {
         return 'undefined';
      }

      if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
         return String(value);
      }

      if (value instanceof Error) {
         return value.stack ?? `${value.name}: ${value.message}`;
      }

      try {
         return JSON.stringify(value);
      } catch {
         return String(value);
      }
   }

   private logDevModeStartup(port: number): void {
      if (this.opts.silent || process.env.NODE_ENV === 'production') return;

      const url = `http://localhost:${port}`;
      this.logger.info(`🎨 Development mode active at ${url}`);

      if (this.basePath) {
         this.logger.info(`📚 API base: ${url}${this.basePath}`);
      }
   }
}

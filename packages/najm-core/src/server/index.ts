// ============================================================================
// Server.ts - Clean plugin approach with opt-in features
// ============================================================================

import { Hono, MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';
import { container, Container } from 'diject';
import { createLogger, LoggerService } from '../logging/LoggerService';
import { BootService } from '../boot/BootService';
import { BootDiagnostics } from '../boot/BootDiagnostics';
import { Err } from '../errors';
import type { NajmPlugin, Constructor, ServerOpts, Loadable, ScanTarget } from './types';
import { ScannerService } from '../scanner';
import { router } from '../router';
import { params } from '../params';
import { middleware } from '../middleware';
import { APP, BASE_PATH, SERVER_OPTS, LOGGER } from './tokens';
import { PluginRegistry } from './PluginRegistry';
import { createListener, type ServerHandle } from './listener';
import { collectInjectables, loadInjectablesFromRoots } from './moduleLoader';
import { StartupLogBuffer, stringifyLogEntry } from './startupLog';
import { normalizeBasePath, normalizePort, DEFAULT_PORT } from './utils';
import { generateOpenAPI, type OpenAPIDocument, type OpenAPIGenerateOptions } from '../router/openapi';

// Re-export plugin builder
export { plugin, type ContributionToken, type PluginContribution } from './plugin';
export { handle } from './handle';

const CORE_SERVICES = [BootService, LoggerService, ScannerService];

type ShutdownSignal = 'SIGINT' | 'SIGTERM';

const enum ServerState {
   IDLE = 'idle',
   INITIALIZING = 'initializing',
   READY = 'ready',
   FAILED = 'failed',
   STOPPED = 'stopped',
}

export class Server {
   public readonly container: Container;
   public readonly app: Hono;
   public basePath = '';

   private readonly opts: ServerOpts = {};
   private logger: LoggerService;
   private readonly registry = new PluginRegistry();
   private readonly middlewareHandlers: MiddlewareHandler[] = [];
   private readonly scanRoots = new Set<string>();
   private readonly startupLogs = new StartupLogBuffer();
   private readonly appServices = new Set<Constructor>();

   private server?: ServerHandle;
   private initPromise?: Promise<void>;
   private initError?: unknown;
   private _fetchHandler?: (req: Request) => Promise<Response>;
   private shutdownHandlers?: Array<{ signal: ShutdownSignal; handler: () => void }>;
   private state: ServerState = ServerState.IDLE;

   private inFlight = 0;
   private drainWaiters: Array<() => void> = [];

   constructor(opts: ServerOpts = {}) {
      this.app = opts.app ?? new Hono({ strict: false });
      this.opts = { ...opts, app: this.app };
      this.container = opts.isolated ? new Container() : container;
      this.logger = createLogger(opts.logger, opts.silent);

      if (opts.requestLogging) {
         this.middleware(this.createRequestLoggingMiddleware());
      }

      if (this.isDrainEnabled()) {
         this.middleware(this.createInFlightMiddleware());
      }

      this.app.onError((error) => Err.handle(error));
   }

   // ============================================================================
   // FLUENT API
   // ============================================================================

   public base(path: string): this {
      this.basePath = normalizeBasePath(path);
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
         this.logger.info(stringifyLogEntry(entry));
      } else {
         this.startupLogs.push(entry);
      }

      return this;
   }

   public use(plugin: NajmPlugin): this {
      this.registry.register(plugin);
      return this;
   }

   public middleware(...handlers: MiddlewareHandler[]): this {
      this.middlewareHandlers.push(...handlers);
      return this;
   }

   public load(...items: Loadable[]): this {
      for (const item of items) {
         if (typeof item === 'function') {
            this.appServices.add(item as Constructor);
         } else if (Array.isArray(item)) {
            for (const ctor of item) {
               this.appServices.add(ctor as Constructor);
            }
         } else if (typeof item === 'object' && item !== null) {
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
      if (this.server) {
         Err.alreadyRunning(this.server.port);
      }

      const rawPort = typeof portOrCb === 'function' || portOrCb === undefined
         ? this.opts.port
         : portOrCb;
      const port = normalizePort(rawPort);
      const callback = typeof portOrCb === 'function' ? portOrCb : cb;

      this.opts.port = port;
      await this.ensureInitialized();

      try {
         this.server = await createListener(this.createFetchHandler(), port);
      } catch (error) {
         if (!this.opts.silent) {
            this.logger.serverError(error);
         }
         throw Err.startFailed(port, error);
      }

      this.logger.serverStarted(this.createStartedInfo(this.server.port));
      this.logDevModeStartup(this.server.port);
      this.flushStartupLogs();
      this.registerGracefulShutdownHandlers();

      callback?.();
      return this;
   }

   private createFetchHandler(): (req: Request) => Response | Promise<Response> {
      return (req) => {
         try {
            const response = this.app.fetch(req);
            return response instanceof Promise
               ? response.catch((error) => this.handleFetchError(error))
               : response;
         } catch (error) {
            return this.handleFetchError(error);
         }
      };
   }

   private handleFetchError(error: unknown): Response {
      if (!this.opts.silent) {
         this.logger.serverError(error);
      }
      return Err.handle(error);
   }

   public async init(): Promise<this> {
      await this.ensureInitialized();
      this.flushStartupLogs();
      return this;
   }

   public async openapi(options: OpenAPIGenerateOptions = {}): Promise<OpenAPIDocument> {
      await this.ensureInitialized();
      return generateOpenAPI(this.container, options);
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
      const shouldDestroy = this.state === ServerState.READY;
      const server = this.server;

      if (!shouldDestroy && !server) return;

      try {
         this.removeGracefulShutdownHandlers();

         // 1. Stop accepting new connections.
         await server?.stop?.();

         // 2. Drain: let in-flight requests finish (up to the configured timeout).
         if (this.inFlight > 0) {
            const timeout = this.resolveShutdownTimeout();
            const drained = await this.drainInFlight(timeout);
            if (!drained) {
               this.logger.warn(
                  `Shutdown drain timed out after ${timeout}ms with ${this.inFlight} request(s) still in flight`,
               );
            }
         }

         // 3. Run onDestroy lifecycle on all services (reverse boot order).
         if (shouldDestroy) {
            const bootService = this.container.get(BootService);
            if (bootService) await bootService.destroy();
         }

         this.server = undefined;
         this.state = ServerState.STOPPED;
         this.initPromise = undefined;
         this._fetchHandler = undefined;
         this.logger.serverStopped();
      } catch (error) {
         throw Err.stopFailed(error);
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
      if (this.state === ServerState.STOPPED) {
         Err.invalidState('Server was stopped; create a new Server instance');
      }
      if (this.state === ServerState.FAILED) {
         throw Err.startFailed(this.resolvePortForErrors(), this.initError);
      }

      return (this.initPromise ??= this.initialize());
   }

   private async initialize(): Promise<void> {
      this.state = ServerState.INITIALIZING;
      this.initError = undefined;
      const startedAt = performance.now();

      this.logger.serverInitializing();

      try {
         this.registerDefaultPlugins();
         this.registry.validatePendingRequirements();
         this.registry.mergeMiddlewareHandlers(this.middlewareHandlers);
         await this.resolveScanRoots();

         const pluginServices = this.registry.applyTo(this.container);
         const coreServices = this.isDiagnosticsEnabled()
            ? [...CORE_SERVICES, BootDiagnostics]
            : CORE_SERVICES;

         this.container
            .set(SERVER_OPTS, this.opts)
            .set(APP, this.app)
            .set(BASE_PATH, this.basePath)
            .set(coreServices)
            .alias(LOGGER, LoggerService)
            .set(pluginServices)
            .set([...this.appServices], { metadata: { layer: 'app' } });

         const bootService = await this.container.resolve(BootService);
         await bootService.boot();
         this.logger = await this.container.resolve(LoggerService);

         await this.materializeAliasTargets();

         this.state = ServerState.READY;
         this.initError = undefined;
         this.logger.serverInitialized(performance.now() - startedAt);
      } catch (error) {
         this.logger.serverError(error);
         this.state = ServerState.FAILED;
         this.initPromise = undefined;
         this.initError = error;
         throw Err.startFailed(this.resolvePortForErrors(), error);
      }
   }

   private registerDefaultPlugins(): void {
      if (!this.registry.has('middleware')) {
         this.registry.register(middleware());
      }

      if (!this.registry.has('params')) {
         this.registry.register(params());
      }

      if (!this.registry.has('router')) {
         this.registry.register(router());
      }
   }

   /**
    * Ensure every plugin alias target is materialised. With diject ^0.1.5,
    * alias() registers a transparent forwarder — get(token) follows to the
    * target — so this only needs to instantiate any target that wasn't part
    * of the booted service set.
    */
   private async materializeAliasTargets(): Promise<void> {
      for (const target of this.registry.aliasTargets()) {
         try {
            await this.container.resolve(target);
         } catch (err) {
            this.logger.error(`Alias target resolve failed for ${target?.name ?? 'anonymous'}`, err);
            throw err;
         }
      }
   }

   private async resolveScanRoots(): Promise<void> {
      if (!this.scanRoots.size) return;

      for (const injectable of await loadInjectablesFromRoots(this.scanRoots)) {
         this.appServices.add(injectable);
      }
   }

   // ============================================================================
   // HELPERS
   // ============================================================================

   private isDiagnosticsEnabled(): boolean {
      return this.opts.diagnostics === true
         || (process.env.NAJM_DEBUG === '1' && process.env.NODE_ENV !== 'production');
   }

   private registerGracefulShutdownHandlers(): void {
      if (!this.opts.gracefulShutdown || this.shutdownHandlers?.length) {
         return;
      }

      if (typeof process === 'undefined' || typeof process.once !== 'function') {
         return;
      }

      this.shutdownHandlers = (['SIGINT', 'SIGTERM'] as ShutdownSignal[]).map((signal) => {
         const handler = () => {
            void this.stop().finally(() => process.exit(0));
         };
         process.once(signal, handler);
         return { signal, handler };
      });
   }

   private isDrainEnabled(): boolean {
      return this.opts.gracefulShutdown === true || this.opts.shutdownTimeout !== undefined;
   }

   private resolveShutdownTimeout(): number {
      const t = this.opts.shutdownTimeout;
      return typeof t === 'number' && t >= 0 ? t : 10_000;
   }

   private createInFlightMiddleware(): MiddlewareHandler {
      return async (_context, next) => {
         this.inFlight++;
         try {
            await next();
         } finally {
            this.inFlight--;
            if (this.inFlight === 0 && this.drainWaiters.length) {
               const waiters = this.drainWaiters;
               this.drainWaiters = [];
               for (const resolve of waiters) resolve();
            }
         }
      };
   }

   private drainInFlight(timeoutMs: number): Promise<boolean> {
      if (this.inFlight === 0) return Promise.resolve(true);

      return new Promise<boolean>((resolve) => {
         let settled = false;
         const done = (ok: boolean) => {
            if (settled) return;
            settled = true;
            resolve(ok);
         };

         this.drainWaiters.push(() => done(true));
         const timer = setTimeout(() => done(false), timeoutMs);
         (timer as { unref?: () => void }).unref?.();
      });
   }

   private removeGracefulShutdownHandlers(): void {
      if (!this.shutdownHandlers?.length) {
         return;
      }

      if (typeof process !== 'undefined' && typeof process.off === 'function') {
         for (const { signal, handler } of this.shutdownHandlers) {
            process.off(signal, handler);
         }
      }

      this.shutdownHandlers = undefined;
   }

   private addInjectablesFromModule(moduleExports: Record<string, unknown>): void {
      for (const injectable of collectInjectables(moduleExports)) {
         this.appServices.add(injectable);
      }
   }

   private resolvePortForErrors(): number {
      try {
         return normalizePort(this.opts.port);
      } catch {
         return DEFAULT_PORT;
      }
   }

   private flushStartupLogs(): void {
      this.startupLogs.flush((message) => this.logger.info(message));
   }

   private createStartedInfo(port: number) {
      const info = {
         port,
         basePath: this.basePath || undefined,
         env: process.env.NODE_ENV ?? 'development',
         runtime: typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`,
         pid: process.pid,
         version: process.env.npm_package_version,
      };

      return Object.fromEntries(
         Object.entries(info).filter(([, value]) => value !== undefined),
      ) as {
         port: number;
         basePath?: string;
         env: string;
         runtime: string;
         pid: number;
         version?: string;
      };
   }

   private createRequestLoggingMiddleware(): MiddlewareHandler {
      return async (context, next) => {
         const startedAt = performance.now();
         const method = context.req.method;
         const path = context.req.path;

         try {
            await next();
            this.logger.requestCompleted(
               method,
               path,
               context.res.status,
               performance.now() - startedAt,
            );
         } catch (error) {
            this.logger.requestError(method, path, error);
            throw error;
         }
      };
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

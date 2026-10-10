// ============================================================================
// Server.ts - Clean plugin approach with opt-in features
// ============================================================================

import { Hono, MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';
import { container, Container, getDecoratorMetadataValue } from 'diject';
import { createLogger, LoggerService } from '../logging/LoggerService';
import { BootService } from '../boot/BootService';
import { BootDiagnostics } from '../boot/BootDiagnostics';
import { Err } from '../errors';
import type { NajmPlugin, Constructor, ServerOpts, Loadable, ScanTarget } from './types';
import { ScannerService } from '../scanner';
import { router } from '../router';
import { params } from '../params';
import { middleware } from '../middleware';
import { APP, BASE_PATH, SERVER_OPTS, LOGGER, DECLARED_CONTROLLERS, DECLARED_PLUGIN_SERVICES, DECLARED_PLUGIN_BOOT_SERVICES, DECLARED_APP_SERVICES } from './tokens';
import { PluginRegistry } from './PluginRegistry';
import { createListener, type ServerHandle } from './listener';
import { collectInjectables, loadInjectablesFromRoots } from './moduleLoader';
import { StartupLogBuffer, stringifyLogEntry } from './startupLog';
import { normalizeBasePath, normalizePort, DEFAULT_PORT } from './utils';
import { generateOpenAPI, type OpenAPIDocument, type OpenAPIGenerateOptions } from '../router/openapi';
import { afterResponse } from '../middleware/responseLifecycle';

// Re-export plugin builder
export { plugin, lazyPlugin, type ContributionToken, type PluginContribution } from './plugin';
export { handle } from './handle';

const CORE_SERVICES = [BootService, LoggerService, ScannerService];

/**
 * The injection entries the last boot on a shared container registered. A dev
 * server's hot reload boots a new Server in the same process while unchanged
 * modules keep their classes, so without this the new boot would see every
 * route, guard and transaction twice. Keyed with `Symbol.for` on the container
 * itself so it survives a reload that re-evaluates this module too.
 */
const BOOT_INJECTIONS = Symbol.for('najm:core:boot-injections');

type BootInjectionRecord = { [BOOT_INJECTIONS]?: unknown[] };

/** Tokens `setInjection` created: symbols carrying an injection `type`. */
function injectionTokens(target: Container): Set<unknown> {
   const tokens = new Set<unknown>();
   for (const token of target.registry.keys()) {
      if (typeof token === 'symbol' && target.hasMeta(token, 'type')) tokens.add(token);
   }
   return tokens;
}

/** Resolves true if `promise` settles within `ms`, false on timeout; rejects if it rejects first. */
function settlesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
   let timer: ReturnType<typeof setTimeout> | undefined;
   const timedOut = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), ms);
      (timer as { unref?: () => void }).unref?.();
   });
   return Promise.race([promise.then(() => true), timedOut]).finally(() => clearTimeout(timer));
}

type ShutdownSignal = 'SIGINT' | 'SIGTERM';

const enum ServerState {
   IDLE = 'idle',
   INITIALIZING = 'initializing',
   READY = 'ready',
   FAILED = 'failed',
   STOPPING = 'stopping',
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
   private listenPromise?: Promise<this>;
   private stopPromise?: Promise<void>;
   private bootService?: BootService;
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
      this.assertNotStopped();
      if (this.server) {
         Err.alreadyRunning(this.server.port);
      }
      if (this.listenPromise) {
         Err.invalidState('Server listener is already starting');
      }

      const rawPort = typeof portOrCb === 'function' || portOrCb === undefined
         ? this.opts.port
         : portOrCb;
      const port = normalizePort(rawPort);
      const callback = typeof portOrCb === 'function' ? portOrCb : cb;

      this.opts.port = port;
      const listening = this.startListener(port, callback);
      this.listenPromise = listening;
      try {
         return await listening;
      } finally {
         if (this.listenPromise === listening) this.listenPromise = undefined;
      }
   }

   private async startListener(port: number, callback?: () => void): Promise<this> {
      await this.ensureInitialized();
      this.assertNotStopped();

      try {
         this.server = await createListener(this.createFetchHandler(), port);
      } catch (error) {
         if (!this.opts.silent) {
            this.logger.serverError(error);
         }
         throw Err.startFailed(port, error);
      }

      // stop() waits for this startup attempt before taking the listener handle.
      // If it raced with binding, publish the handle so shutdown can close it.
      this.assertNotStopped();
      this.logger.serverStarted(this.createStartedInfo(this.server.port));
      this.logDevModeStartup(this.server.port);
      this.flushStartupLogs();
      this.registerGracefulShutdownHandlers();

      callback?.();
      return this;
   }

   private createFetchHandler(): (req: Request, env?: unknown) => Response | Promise<Response> {
      return (req, env) => {
         try {
            this.assertNotStopped();
            // Forward the runtime binding so `c.env` can yield the socket peer.
            const response = this.app.fetch(req, env as Parameters<typeof this.app.fetch>[1]);
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
         this.assertNotStopped();
         return this.app.fetch(req);
      });
   }

   public async stop(): Promise<void> {
      if (this.stopPromise) return this.stopPromise;
      if (this.state === ServerState.STOPPED) return;
      if (this.state !== ServerState.READY && !this.initPromise && !this.listenPromise && !this.server) return;

      this.state = ServerState.STOPPING;
      return (this.stopPromise = this.shutdown());
   }

   private async shutdown(): Promise<void> {
      const errors: unknown[] = [];
      this.removeGracefulShutdownHandlers();

      // Startup may still be resolving resources or binding a listener. Its
      // failures already trigger rollback; either way, wait before teardown.
      await Promise.allSettled([this.initPromise, this.listenPromise]);

      // 1–2. Stop accepting connections and drain in-flight requests. The
      // runtime's close waits for active requests, so the timeout must bound
      // the close itself, not start after it.
      try {
         await this.closeListener(this.server);
      } catch (error) {
         errors.push(error);
      }

      // 3. Run onDestroy lifecycle on owned services (reverse resolution order).
      if (this.bootService) {
         try {
            await this.bootService.destroy();
         } catch (error) {
            errors.push(error);
         }
      }

      // Stopped even when cleanup failed: the instance must not keep serving.
      this.server = undefined;
      this.bootService = undefined;
      this.state = ServerState.STOPPED;
      this.initPromise = undefined;
      this.stopPromise = undefined;
      this._fetchHandler = undefined;

      if (errors.length) {
         throw Err.stopFailed(errors.length === 1
            ? errors[0]
            : new AggregateError(errors, `${errors.length} shutdown steps failed`));
      }

      this.logger.serverStopped();
   }

   private async closeListener(server: ServerHandle | undefined): Promise<void> {
      const timeout = this.resolveShutdownTimeout();
      const closed = Promise.all([server?.stop?.(), this.waitForInFlight()]);
      const finished = await settlesWithin(closed, timeout);

      if (!finished) {
         this.logger.warn(this.inFlight > 0
            ? `Shutdown drain timed out after ${timeout}ms with ${this.inFlight} request(s) still in flight; closing connections`
            : `Shutdown drain timed out after ${timeout}ms; closing connections`);
         // Not awaited: Bun's forced stop still settles only when the stalled
         // handler does (or its idle timeout fires), which would unbound stop().
         Promise.resolve(server?.stop?.(true)).catch((error) => {
            this.logger.error('Forced listener close failed', error);
         });
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
      this.assertNotStopped();
      if (this.state === ServerState.READY) return;
      if (this.state === ServerState.FAILED) {
         throw Err.startFailed(this.resolvePortForErrors(), this.initError);
      }

      await (this.initPromise ??= this.initialize());
      this.assertNotStopped();
   }

   private assertNotStopped(): void {
      if (this.state === ServerState.STOPPING) {
         Err.invalidState('Server is stopping; create a new Server instance');
      }
      if (this.state === ServerState.STOPPED) {
         Err.invalidState('Server was stopped; create a new Server instance');
      }
   }

   private async initialize(): Promise<void> {
      this.state = ServerState.INITIALIZING;
      this.initError = undefined;
      const startedAt = performance.now();

      this.logger.serverInitializing();
      let bootService: BootService | undefined;

      // On the shared container, this boot replaces the previous one.
      // An isolated container starts empty and holds no other boot.
      const shared = !this.opts.isolated;
      if (shared) await this.releasePreviousBootInjections();
      const injectionsBefore = shared ? injectionTokens(this.container) : undefined;

      try {
         this.registerDefaultPlugins();
         for (const warning of this.registry.takeIgnoredConfigWarnings()) {
            this.logger.warn(warning);
         }
         this.registry.validatePendingRequirements();
         this.registry.mergeMiddlewareHandlers(this.middlewareHandlers);
         await this.resolveScanRoots();

         const pluginServices = this.registry.applyTo(this.container);
         const pluginBootServices = new Set(pluginServices.filter(
            (service) => getDecoratorMetadataValue(service, 'layer') === 'plugin',
         ));
         const coreServices = this.isDiagnosticsEnabled()
            ? [...CORE_SERVICES, BootDiagnostics]
            : CORE_SERVICES;

         this.container
            .set(SERVER_OPTS, this.opts)
            .set(APP, this.app)
            .set(BASE_PATH, this.basePath)
            .set(coreServices)
            .alias(LOGGER, LoggerService)
            .set(DECLARED_PLUGIN_SERVICES, new Set(pluginServices))
            .set(DECLARED_PLUGIN_BOOT_SERVICES, pluginBootServices)
            .set(DECLARED_APP_SERVICES, new Set(this.appServices))
            .set(DECLARED_CONTROLLERS, new Set([...pluginServices, ...this.appServices]))
            .set(pluginServices, { metadata: { layer: 'plugin' } })
            .set([...this.appServices], { metadata: { layer: 'app' } });

         if (process.env.NODE_ENV !== 'production') {
            const declared = this.container.get(DECLARED_CONTROLLERS) as Set<Constructor>;
            const skipped = this.container.find({ type: 'controller' })
               .filter((controller): controller is Constructor => typeof controller === 'function' && !declared.has(controller));
            if (skipped.length) {
               this.logger.warn('Decorated controllers were imported but not declared; their routes are not mounted', {
                  controllers: skipped.map((controller) => controller.name),
               });
            }
         }

         bootService = await this.container.resolve(BootService);
         this.bootService = bootService;
         await bootService.boot();
         this.logger = await this.container.resolve(LoggerService);

         await this.materializeAliasTargets();

         // stop() can change the state while the awaited boot phases run.
         if ((this.state as ServerState) !== ServerState.STOPPING) this.state = ServerState.READY;
         this.initError = undefined;
         this.logger.serverInitialized(performance.now() - startedAt);
      } catch (error) {
         this.logger.serverError(error);

         // Services that booted before the failure may hold open resources,
         // and a FAILED server's stop() has nothing to tear down later.
         try {
            await bootService?.destroy();
         } catch (cleanupError) {
            this.logger.error('Teardown after failed startup also failed', cleanupError);
         }

         if ((this.state as ServerState) !== ServerState.STOPPING) this.state = ServerState.FAILED;
         this.initPromise = undefined;
         this.initError = error;
         throw Err.startFailed(this.resolvePortForErrors(), error);
      } finally {
         // Recorded whether the boot succeeded or not, so the next boot,
         // a retry or a reload, starts without this one's entries.
         if (injectionsBefore) {
            (this.container as BootInjectionRecord)[BOOT_INJECTIONS] = [...injectionTokens(this.container)]
               .filter((token) => !injectionsBefore.has(token));
         }
      }
   }

   /**
    * Drops the injection entries the previous boot on this container left.
    * A server still running from that boot keeps the routes it mounted, but
    * the container now describes this boot; concurrent servers that must not
    * affect each other use `isolated: true`.
    */
   private async releasePreviousBootInjections(): Promise<void> {
      const record = this.container as BootInjectionRecord;
      const previous = record[BOOT_INJECTIONS];
      record[BOOT_INJECTIONS] = undefined;
      if (!previous?.length) return;

      for (const token of previous) {
         if (this.container.registry.has(token as never)) await this.container.delete(token as never);
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
      return async (context, next) => {
         this.inFlight++;
         try {
            await next();
         } finally {
            await afterResponse(context, () => {
               this.inFlight--;
               if (this.inFlight === 0 && this.drainWaiters.length) {
                  const waiters = this.drainWaiters;
                  this.drainWaiters = [];
                  for (const resolve of waiters) resolve();
               }
            });
         }
      };
   }

   private waitForInFlight(): Promise<void> {
      if (this.inFlight === 0) return Promise.resolve();
      return new Promise<void>((resolve) => this.drainWaiters.push(resolve));
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

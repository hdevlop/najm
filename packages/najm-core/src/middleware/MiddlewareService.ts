import { Context, Hono, MiddlewareHandler, Next } from 'hono';
import { randomUUID } from 'node:crypto';
import { Service, Meta, DI, Inject, Container, Constructor } from 'diject';
import { Scan, ScannerService, ScanType, INJECTION_TYPES } from '../scanner';
import { APP, LOGGER } from '../server/tokens';
import type { LoggerService } from '../logging';
import { MIDDLEWARE_CONFIG } from './tokens';
import {
   isMiddlewareClass,
   getMiddlewareOptions,
   getUseInjections,
} from './decorator';
import type {
   MiddlewareConfig,
   MiddlewarePluginConfig,
   MiddlewareClass,
   Interceptor,
} from './types';
import { clearRequestContextCache } from '../params/requestContext';

let requestIdSeq = 0;

function createFastRequestId(): string {
   return `${process.pid.toString(36)}-${(requestIdSeq++).toString(36)}`;
}

@Service()
@Meta({ layer: 'plugin', order: 5 })
export class MiddlewareService {
   @DI() private container!: Container;
   @Scan() private scanner!: ScannerService;
   @Inject(APP) private app!: Hono;
   @Inject(MIDDLEWARE_CONFIG) private config!: MiddlewarePluginConfig;
   @Inject(LOGGER) private log!: LoggerService;


   private parsedConfig!: MiddlewareConfig;
   private middlewareClasses: Constructor[] = [];

   private static readonly DEFAULT_CONFIG: MiddlewareConfig = {
      debug: false,
      requestIdHeader: 'x-request-id',
      requestId: 'fast',
      exclude: [],
      use: [],
   };

   // ============================================================================
   // LIFECYCLE: SCAN
   // ============================================================================

   async scan(): Promise<void> {
      // Scan @Middleware() decorated classes
      this.scanner.scan(ScanType.MIDDLEWARE, {
         onClass: (provider) => {
            if (isMiddlewareClass(provider)) {
               this.middlewareClasses.push(provider);
               const options = getMiddlewareOptions(provider);
               if (options) {
                  this.container.setInjection({
                     type: INJECTION_TYPES.MIDDLEWARE_CLASS,
                     target: provider,
                     options,
                  });
               }
            }
         }
      });

      // Scan @Use() decorated properties in app services
      this.scanner.scan(ScanType.APP, {
         onClass: (provider) => {
            const useInjections = getUseInjections(provider);
            for (const { propertyKey, options } of useInjections) {
               this.container.setInjection({
                  type: INJECTION_TYPES.MIDDLEWARE_USE,
                  target: provider,
                  propertyKey,
                  options,
               });
            }
         }
      });

      this.log.debug?.(`Scanned ${this.middlewareClasses.length} middleware class(es)`);
   }

   // ============================================================================
   // LIFECYCLE: CONFIGURE
   // ============================================================================

   async configure(): Promise<void> {
      this.parseConfig();
      this.registerCoreMiddleware();
      this.registerConfigMiddleware();
   }

   private parseConfig(): void {
      const config = this.config;

      if (!config || config === true) {
         this.parsedConfig = { ...MiddlewareService.DEFAULT_CONFIG };
      } else if (config === null) {
         this.parsedConfig = { ...MiddlewareService.DEFAULT_CONFIG };
      } else {
         this.parsedConfig = {
            ...MiddlewareService.DEFAULT_CONFIG,
            ...config,
         };
      }
   }

   private registerCoreMiddleware(): void {
      this.container.setInjection({
         type: INJECTION_TYPES.MIDDLEWARE,
         scope: 'global',
         name: 'request-context',
         order: 1,
         handler: this.createRequestContextMiddleware(),
      });
   }

   private createRequestContextMiddleware(): MiddlewareHandler {
      const headerName = this.parsedConfig.requestIdHeader ?? 'x-request-id';
      const requestIdGenerator = this.parsedConfig.requestId ?? 'fast';

      return async (context: Context, next: Next) => {
         const requestId = context.req.header(headerName)
            || this.createRequestId(context, requestIdGenerator);

         // Echo the id back so clients and downstream proxies can correlate the
         // request with server logs (the logger already tags entries via ALS).
         context.header(headerName, requestId);

         return this.container.run(
            {
               requestId,
               context
            },
            async () => {
               try {
                  return await next();
               } finally {
                  try {
                     if (this.hasRequestScopeWork(requestId)) {
                        await this.container.cleanupReq(requestId);
                     }
                  } catch (error) {
                     this.log.error?.('Failed to cleanup request scope', error);
                  } finally {
                     clearRequestContextCache(context);
                  }
               }
            }
         );
      };
   }

   private createRequestId(
      context: Context,
      generator: NonNullable<MiddlewareConfig['requestId']>
   ): string {
      if (typeof generator === 'function') {
         return generator(context);
      }

      return generator === 'uuid' ? randomUUID() : createFastRequestId();
   }

   private hasRequestScopeWork(requestId: string): boolean {
      return this.container.requestScoped.has(requestId)
         || this.container.requestPromises.has(requestId);
   }

   private registerConfigMiddleware(): void {
      if (!this.parsedConfig.use?.length) return;
      for (let i = 0; i < this.parsedConfig.use.length; i++) {
         this.container.setInjection({
            type: INJECTION_TYPES.MIDDLEWARE,
            scope: 'global',
            name: `config-middleware-${i}`,
            order: 60 + i,
            handler: this.parsedConfig.use[i],
         });
      }
   }

   // ============================================================================
   // LIFECYCLE: ACTIVATE
   // ============================================================================

   async activate(): Promise<void> {
      await this.activateMiddlewareClasses();
      await this.activateUseDecorators();
      await this.applyAllMiddleware();
   }

   private async activateMiddlewareClasses(): Promise<void> {
      const injections = this.container.getInjections<any>(INJECTION_TYPES.MIDDLEWARE_CLASS);

      this.log.debug?.(`Found ${injections.length} middleware class injections`);

      for (const injection of injections) {
         const { target, options } = injection;

         // Store the target class instead of resolving immediately
         // This allows the instance to be resolved fresh on each request with proper DI
         const handler: MiddlewareHandler = async (ctx, next) => {
            // Resolve the instance at request time to ensure all dependencies are injected
            const instance = await this.container.resolve(target) as MiddlewareClass;
            return instance.use.call(instance, ctx, next);
         };

         this.container.setInjection({
            type: INJECTION_TYPES.MIDDLEWARE,
            scope: 'global',
            name: options.name ?? target.name,
            order: options.order ?? 100,
            path: options.path,
            handler,
         });

         this.log.debug?.(`Registered middleware: ${options.name ?? target.name} (order: ${options.order ?? 100})`);
      }
   }

   private async activateUseDecorators(): Promise<void> {
      const injections = this.container.getInjections<any>(INJECTION_TYPES.MIDDLEWARE_USE);

      for (const injection of injections) {
         const { target, propertyKey, options } = injection;

         const instance = await this.container.resolve(target);
         const handler = instance[propertyKey];

         if (typeof handler !== 'function') {
            this.log.warn(`@Use() property ${String(propertyKey)} is not a function`);
            continue;
         }

         this.container.setInjection({
            type: INJECTION_TYPES.MIDDLEWARE,
            scope: 'global',
            name: `use-${target.name}-${String(propertyKey)}`,
            order: options.order ?? 100,
            path: options.path,
            handler,
         });
      }
   }

   private async applyAllMiddleware(): Promise<void> {
      const interceptors = this.container.getInjections<Interceptor>(INJECTION_TYPES.MIDDLEWARE);
      const sorted = [...interceptors].sort((a, b) => a.order - b.order);
      for (const interceptor of sorted) {
         if (interceptor.scope !== 'global') {
            continue;
         }

         if (this.isExcluded(interceptor.path)) {
            continue;
         }

         this.apply(interceptor.handler, interceptor.path);
      }
   }

   public apply(middleware: MiddlewareHandler | MiddlewareHandler[], path?: string): void {
      const finalPath = path ?? '*';
      if (Array.isArray(middleware)) {
         middleware.forEach(mw => this.app.use(finalPath, mw));
      } else {
         this.app.use(finalPath, middleware);
      }
   }

   private isExcluded(path?: string): boolean {
      if (!path || !this.parsedConfig.exclude?.length) return false;
      return this.parsedConfig.exclude.some(p => path.startsWith(p));
   }

   // ============================================================================
   // LIFECYCLE: READY
   // ============================================================================

   async onReady(): Promise<void> {
      const count = this.container.getInjections(INJECTION_TYPES.MIDDLEWARE).length;
      this.log.info(`Middleware plugin ready: ${count} middleware(s) applied`);
   }

   // ============================================================================
   // PUBLIC API
   // ============================================================================


   public use(handler: MiddlewareHandler, options?: { order?: number; path?: string; name?: string }): void {
      this.container.setInjection({
         type: INJECTION_TYPES.MIDDLEWARE,
         scope: 'global',
         name: options?.name ?? `dynamic-${Date.now()}`,
         order: options?.order ?? 50,
         path: options?.path,
         handler,
      });
   }

   public getApp(): any {
      return this.app;
   }

   public getStats() {
      const all = this.container.getInjections<Interceptor>(INJECTION_TYPES.MIDDLEWARE);
      return {
         total: all.length,
         core: all.filter(m => m.order <= 10).length,
         user: all.filter(m => m.order > 10 && m.order < 100).length,
         decorator: all.filter(m => m.order >= 100).length,
         middlewares: all.map(m => ({
            name: m.name,
            order: m.order,
            path: m.path ?? '*',
         })),
      };
   }
}

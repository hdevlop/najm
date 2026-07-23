import { Service, Meta, DI, Container, Constructor, Inject, getPath, getScope, Scope } from 'diject';
import { Scan, ScanType, ScannerService, INJECTION_TYPES } from '../scanner';
import { Err } from '../errors';
import { APP, BASE_PATH, LOGGER } from '../server/tokens';
import type { LoggerService } from '../logging';
import { Context, Hono, MiddlewareHandler } from 'hono';
import { HTTP_METHODS, HttpMethod, MiddlewareInjection, ParamsInjection, RouteEntry, type RouterPluginConfig } from './types';
import { getRoutes } from './decorator';
import { ROUTER_CONFIG } from './tokens';
import { ResponseFormatter } from './ResponseFormatter';
import { getResponseMessage, shouldSkipWrapping, type ResponseConfig } from './response';

// Optional i18n integration
const I18N_SERVICE = Symbol.for('I18nService');
const NO_ARGS: unknown[] = [];

@Service()
@Meta({ layer: 'plugin', order: 90 })
export class RouterService {
   @DI() private container!: Container;
   @Scan() private scanner!: ScannerService;
   @Inject(ROUTER_CONFIG) private config!: RouterPluginConfig;
   @Inject(APP) private app!: Hono;
   @Inject(BASE_PATH) private basePath!: string;
   @Inject(LOGGER) private log!: LoggerService;

   private middlewareCache = new WeakMap<Constructor, Map<string, MiddlewareHandler[]>>();
   private responseConfig: ResponseConfig = {};
   private translator?: (key: string) => string;

   // ============================================================================
   // LIFECYCLE
   // ============================================================================

   async scan(): Promise<void> {
      const basePath = this.basePath || this.config?.basePath || '';

      this.scanner.scan(ScanType.CONTROLLER, {
         onClass: (controller) => this.scanController(controller, basePath),
      });

      this.log.debug?.(`Scanned ${this.controllerCount} controller(s)`);
   }

   async configure(): Promise<void> {
      this.basePath = this.basePath || this.config?.basePath || '';
      this.middlewareCache = new WeakMap<Constructor, Map<string, MiddlewareHandler[]>>();

      // Parse response config with environment variable support
      const envAutoWrap = process.env.ROUTER_AUTO_WRAP;
      const autoWrapFromEnv = envAutoWrap !== undefined
         ? envAutoWrap === 'true'
         : undefined;

      this.responseConfig = {
         autoWrap: this.config?.response?.autoWrap ?? autoWrapFromEnv ?? false,
         defaultStatus: this.config?.response?.defaultStatus ?? 'success',
         includeTimestamp: this.config?.response?.includeTimestamp ?? false,
      };
   }

   async activate(): Promise<void> {
      const routes = this.container.getInjections<RouteEntry>(INJECTION_TYPES.ROUTE);
      routes.forEach((route) => this.registerRoute(route));
      this.log.debug?.(`Registered ${routes.length} route(s)`);
   }

   async onReady(): Promise<void> {
      this.translator = this.getTranslator();
      this.log.debug(`Router plugin ready: ${this.routeCount} route(s) registered`);
   }

   // ============================================================================
   // SCANNING
   // ============================================================================

   private scanController(controller: Constructor, basePath: string): void {
      const routes = getRoutes(controller);
      if (!routes?.length) return;

      const prefix = getPath(controller) ?? '';

      for (const route of routes) {
         this.container.setInjection({
            type: INJECTION_TYPES.ROUTE,
            target: controller,
            methodName: route.methodName,
            method: route.method.toUpperCase(),
            path: this.buildPath(basePath, prefix, route.path),
            handler: route.handler,
         });
      }
   }

   private buildPath(...segments: string[]): string {
      const path = segments
         .filter(Boolean)
         .join('/')
         .replace(/\/+/g, '/')
         .replace(/(.+)\/$/, '$1');

      return path || '/';
   }

   // ============================================================================
   // REGISTRATION
   // ============================================================================

   private registerRoute(route: RouteEntry): void {
      const { method, path } = route;
      const honoMethod = method.toLowerCase();

      if (!this.isValidMethod(honoMethod)) {
         Err.invalidConfig(path, `Invalid HTTP method "${method}"`);
      }

      try {
         const middlewares = this.buildMiddlewareChain(route);
         this.app[honoMethod](path, ...middlewares);
      } catch (cause) {
         Err.registrationFailed(method, path, cause);
      }
   }

   private isValidMethod(method: string): method is HttpMethod {
      return HTTP_METHODS.includes(method as HttpMethod);
   }

   private buildMiddlewareChain(route: RouteEntry): MiddlewareHandler[] {
      const middlewares = this.getMiddlewares(route.target, route.methodName);
      return [
         ...middlewares,
         this.createHandler(route, middlewares.length > 0),
      ];
   }

   // ============================================================================
   // MIDDLEWARE
   // ============================================================================

   private getMiddlewares(controller: Constructor, methodName: string): MiddlewareHandler[] {
      let controllerCache = this.middlewareCache.get(controller);
      if (!controllerCache) {
         controllerCache = new Map<string, MiddlewareHandler[]>();
         this.middlewareCache.set(controller, controllerCache);
      }

      const cached = controllerCache.get(methodName);
      if (cached) return cached;

      const middlewares = this.container
         .getInjectionsFor(INJECTION_TYPES.MIDDLEWARE, controller)
         .filter(isMiddlewareInjection)
         .filter((inj) => !inj.methodName || inj.methodName === methodName)
         .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
         .map((inj) => inj.handler);

      controllerCache.set(methodName, middlewares);
      return middlewares;
   }

   // ============================================================================
   // HANDLER
   // ============================================================================

   private createHandler(route: RouteEntry, hasRouteMiddlewares: boolean): MiddlewareHandler {
      const { target, methodName, handler } = route;
      const messageOptions = getResponseMessage(target, methodName as string);
      const skipWrapping = shouldSkipWrapping(target, methodName as string);
      const [paramsInjection] = this.container.getInjectionsFor<ParamsInjection>(
         INJECTION_TYPES.PARAMS,
         target,
         methodName
      );
      const resolveArgs = paramsInjection?.resolve;
      const resolveArgsSync = paramsInjection?.resolveSync ?? (paramsInjection ? undefined : () => NO_ARGS);
      const fastParamKey = hasRouteMiddlewares ? undefined : getSingleFastParamKey(paramsInjection, handler);
      const canBypassFormatter = !messageOptions && (skipWrapping || !this.responseConfig.autoWrap);
      const isSingleton = getScope(target) === Scope.SINGLETON;
      let cachedInstance: unknown;

      return ((ctx: Context) => {
         try {
            if (isSingleton && cachedInstance && resolveArgsSync && canBypassFormatter) {
               const result = fastParamKey === undefined
                  ? handler.call(cachedInstance, ...resolveArgsSync())
                  : handler.call(cachedInstance, ctx.req.param(fastParamKey));
               if (result instanceof Promise) {
                  return result
                     .then((value) => this.formatRouteResult(ctx, value, {
                        canBypassFormatter,
                        translator: this.translator,
                        responseConfig: this.responseConfig,
                        messageOptions,
                        skipWrapping,
                     }))
                     .catch((error) => Err.handle(error));
               }

               return this.formatRouteResult(ctx, result, {
                  canBypassFormatter,
                  translator: this.translator,
                  responseConfig: this.responseConfig,
                  messageOptions,
                  skipWrapping,
               });
            }

            return this.invokeRoute(ctx, {
               target,
               handler,
               resolveArgs,
               canBypassFormatter,
               isSingleton,
               getCachedInstance: () => cachedInstance,
               setCachedInstance: (instance) => {
                  cachedInstance = instance;
               },
               messageOptions,
               skipWrapping,
            });
         } catch (error) {
            return Err.handle(error);
         }
      }) as MiddlewareHandler;
   }

   private async invokeRoute(
      ctx: Context,
      route: {
         target: Constructor;
         handler: Function;
         resolveArgs?: () => Promise<unknown[]>;
         canBypassFormatter: boolean;
         isSingleton: boolean;
         getCachedInstance: () => unknown;
         setCachedInstance: (instance: unknown) => void;
         messageOptions?: ReturnType<typeof getResponseMessage>;
         skipWrapping: boolean;
      }
   ): Promise<Response> {
      try {
         let instance = route.getCachedInstance();

         if (!instance) {
            instance = route.isSingleton
               ? await this.container.resolve(route.target)
               : await this.container.resolve(route.target);
            if (route.isSingleton) {
               route.setCachedInstance(instance);
            }
         } else if (!route.isSingleton) {
            instance = await this.container.resolve(route.target);
         }

         const args = await route.resolveArgs?.() ?? [];
         const result = await route.handler.call(instance, ...args);

         return this.formatRouteResult(ctx, result, {
            canBypassFormatter: route.canBypassFormatter,
            translator: this.translator,
            responseConfig: this.responseConfig,
            messageOptions: route.messageOptions,
            skipWrapping: route.skipWrapping,
         });
      } catch (error) {
         return Err.handle(error);
      }
   }

   private formatRouteResult(
      ctx: Context,
      result: unknown,
      options: {
         canBypassFormatter: boolean;
         translator?: (key: string) => string;
         responseConfig: ResponseConfig;
         messageOptions?: ReturnType<typeof getResponseMessage>;
         skipWrapping: boolean;
      }
   ): Response {
      if (options.canBypassFormatter && canReturnJsonDirectly(result)) {
         return ctx.json(result);
      }

      const formatter = new ResponseFormatter(ctx, {
         translator: options.translator,
         config: options.responseConfig,
         messageOptions: options.messageOptions,
         skipWrapping: options.skipWrapping,
      });
      return formatter.formatResponse(result);
   }

   /**
    * Get translator function from i18n service if available
    */
   private getTranslator(): ((key: string) => string) | undefined {
      try {
         // Try to get I18nService if it exists
         if (this.container.has(I18N_SERVICE)) {
            const i18nService = this.container.get(I18N_SERVICE) as { t: (key: string) => string };
            return i18nService.t.bind(i18nService);
         }
      } catch {
         // I18n not available, that's fine
      }
      return undefined;
   }

   // ============================================================================
   // PUBLIC API
   // ============================================================================

   get routeCount(): number {
      return this.container.getInjections(INJECTION_TYPES.ROUTE).length;
   }

   get controllerCount(): number {
      return this.scanner.find(ScanType.CONTROLLER).length;
   }

   clearCache(): void {
      this.middlewareCache = new WeakMap<Constructor, Map<string, MiddlewareHandler[]>>();
   }
}

// ============================================================================
// HELPERS
// ============================================================================

function isMiddlewareInjection(inj: unknown): inj is MiddlewareInjection {
   return (
      typeof inj === 'object' &&
      inj !== null &&
      'handler' in inj &&
      typeof (inj as MiddlewareInjection).handler === 'function'
   );
}

function canReturnJsonDirectly(response: unknown): response is Record<string, unknown> {
   const object = response as Record<string, unknown>;

   return (
      typeof response === 'object' &&
      response !== null &&
      !(response instanceof Response) &&
      !(response instanceof ReadableStream) &&
      !('redirect' in response) &&
      !(typeof object.status === 'string' && 'data' in response) &&
      !(typeof object.status === 'number') &&
      !(typeof object.statusCode === 'number')
   );
}

function getSingleFastParamKey(paramsInjection: ParamsInjection | undefined, handler: Function): string | undefined {
   const metadata = paramsInjection?.metadata;
   if (!metadata || metadata.length !== 1 || handler.length !== 1) {
      return undefined;
   }

   const [meta] = metadata as Array<{ type?: unknown; propertyKey?: unknown }>;
   return meta.type === 'params' && typeof meta.propertyKey === 'string'
      ? meta.propertyKey
      : undefined;
}

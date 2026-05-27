import { Service, Meta, DI, Container, Constructor, Inject, getPath } from 'diject';
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

@Service()
@Meta({ layer: 'plugin', order: 90 })
export class RouterService {
   @DI() private container!: Container;
   @Scan() private scanner!: ScannerService;
   @Inject(ROUTER_CONFIG) private config!: RouterPluginConfig;
   @Inject(APP) private app!: Hono;
   @Inject(BASE_PATH) private basePath!: string;
   @Inject(LOGGER) private log!: LoggerService;

   private middlewareCache = new Map<string, MiddlewareHandler[]>();
   private responseConfig: ResponseConfig = {};

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
      this.basePath = this.config?.basePath ?? '';
      this.middlewareCache.clear();

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
      this.log.info(`Router plugin ready: ${this.routeCount} route(s) registered`);
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
         Err.registrationFailed(method, path);
      }
   }

   private isValidMethod(method: string): method is HttpMethod {
      return HTTP_METHODS.includes(method as HttpMethod);
   }

   private buildMiddlewareChain(route: RouteEntry): MiddlewareHandler[] {
      return [
         ...this.getMiddlewares(route.target, route.methodName),
         this.createHandler(route),
      ];
   }

   // ============================================================================
   // MIDDLEWARE
   // ============================================================================

   private getMiddlewares(controller: Constructor, methodName: string): MiddlewareHandler[] {
      const cacheKey = `${controller.name}:${methodName}`;
      const cached = this.middlewareCache.get(cacheKey);
      if (cached) return cached;

      const middlewares = this.container
         .getInjectionsFor(INJECTION_TYPES.MIDDLEWARE, controller)
         .filter(isMiddlewareInjection)
         .filter((inj) => !inj.methodName || inj.methodName === methodName)
         .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
         .map((inj) => inj.handler);

      this.middlewareCache.set(cacheKey, middlewares);
      return middlewares;
   }

   // ============================================================================
   // HANDLER
   // ============================================================================

   private createHandler(route: RouteEntry): MiddlewareHandler {
      const { target, methodName, handler } = route;

      return async (ctx: Context) => {
         // Get @ResMsg() decorator options
         const messageOptions = getResponseMessage(target, methodName as string);
         
         // Check if @RawResponse() or @RawController()
         const skipWrapping = shouldSkipWrapping(target, methodName as string);
         
         // Try to get translator from i18n service
         const translator = this.getTranslator();

         const formatter = new ResponseFormatter(ctx, {
            translator,
            config: this.responseConfig,
            messageOptions,
            skipWrapping,
         });

         try {
            const instance = await this.container.resolve(target);
            const args = await this.resolveArgs(target, methodName);
            const result = await handler.call(instance, ...args);
            return formatter.formatResponse(result);
         } catch (error) {
            return Err.handle(error);
         }
      };
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

   private async resolveArgs(target: Constructor, methodName: string): Promise<unknown[]> {
      const [injection] = this.container.getInjectionsFor<ParamsInjection>(
         INJECTION_TYPES.PARAMS,
         target,
         methodName
      );

      return injection?.resolve?.() ?? [];
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
      this.middlewareCache.clear();
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

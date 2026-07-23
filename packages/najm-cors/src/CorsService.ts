import { cors as honoCors } from 'hono/cors';
import { Context, MiddlewareHandler, Next } from 'hono';
import type { CorsOptions, CorsPluginConfig, CorsDecoratorOptions } from './types';
import { LoggerService, ScannerService, Scan, ScanType, INJECTION_TYPES, Err } from 'najm-core';
import { CORS_CONFIG } from './tokens';
import { Constructor, Container, DI, Inject, Meta, Service } from 'najm-core';
import { getCorsOptions } from './decorator';

@Service()
@Meta({ layer: 'plugin' })
export class CorsService {
   @DI() private container!: Container;
   @Scan() private scanner!: ScannerService;
   @Inject(CORS_CONFIG) private config!: CorsPluginConfig;
   @Inject(LoggerService) private log!: LoggerService;

   private globalConfig: CorsOptions | null = null;
   private controllerConfigs = new Map<Constructor, CorsDecoratorOptions>();
   private methodCorsCount = 0;

   private static readonly DEFAULT_CONFIG: CorsOptions = {
      origin: 'http://localhost:3000',
      allowMethods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
   };

   // ============================================================================
   // LIFECYCLE: SCAN
   // ============================================================================

   async scan(): Promise<void> {
      this.methodCorsCount = 0;

      this.scanner.scan(ScanType.CONTROLLER, {
         onClass: (controller) => {
            const classOptions = getCorsOptions(controller);
            if (classOptions) {
               this.validateOptions(classOptions, controller.name);
               this.controllerConfigs.set(controller, classOptions);

               // Register class-level CORS as middleware for all methods
               this.container.setInjection({
                  type: INJECTION_TYPES.MIDDLEWARE,
                  target: controller,
                  handler: this.createRouteMiddleware(classOptions),
                  order: 10,
                  source: 'cors',
               });
               this.methodCorsCount++;
            }
         },
         onMethod: (controller, methodName) => {
            const methodOptions = getCorsOptions(controller, methodName);
            if (methodOptions) {
               this.validateOptions(methodOptions, `${controller.name}.${methodName}`);
               this.container.setInjection({
                  type: INJECTION_TYPES.MIDDLEWARE,
                  target: controller,
                  methodName,
                  handler: this.createRouteMiddleware(methodOptions),
                  order: 10,
                  source: 'cors',
               });
               this.methodCorsCount++;
            }
         }
      });
   }

   private validateOptions(options: CorsDecoratorOptions, location: string): void {
      if (options.origin === '*' && options.credentials) {
         this.log.warn(
            `Warning at ${location}: Using wildcard origin (*) with credentials is not recommended`
         );
      }
   }

   // ============================================================================
   // LIFECYCLE: CONFIGURE
   // ============================================================================

   async configure(): Promise<void> {
      this.parseGlobalConfig();

      if (this.globalConfig) {
         this.registerGlobalMiddleware();
      }

      this.registerInjector();
   }

   private parseGlobalConfig(): void {
      const corsOption = this.config;

      if (!corsOption) {
         this.globalConfig = null;
         return;
      }

      if (corsOption === true || Object.keys(corsOption).length === 0) {
         this.globalConfig = { ...CorsService.DEFAULT_CONFIG };
      } else {
         const mappedConfig = this.mapConfigToHono(corsOption);
         this.globalConfig = {
            ...CorsService.DEFAULT_CONFIG,
            ...mappedConfig,
         };
      }

      this.validateGlobalConfig(this.globalConfig);
   }

   private mapConfigToHono(config: any): CorsOptions {
      const mapped: any = { ...config };

      if ('origins' in mapped) {
         mapped.origin = mapped.origins;
         delete mapped.origins;
      }

      return mapped;
   }

   private validateGlobalConfig(config: CorsOptions): void {
      const origin = config.origin;

      if (typeof origin === 'string' && origin.trim() === '') {
         throw Err.invalidConfig('cors.origin', 'Origin cannot be an empty string');
      }

      if (typeof origin === 'string' && origin !== '*') {
         try {
            new URL(origin);
         } catch {
            throw Err.invalidConfig('cors.origin', `Invalid origin URL: ${origin}`);
         }
      }

      if (Array.isArray(origin)) {
         for (const o of origin) {
            if (typeof o === 'string' && o.trim() === '') {
               throw Err.invalidConfig('cors.origin', 'Origin array cannot contain empty strings');
            }
            if (typeof o === 'string' && o !== '*') {
               try {
                  new URL(o);
               } catch {
                  throw Err.invalidConfig('cors.origin', `Invalid origin URL in array: ${o}`);
               }
            }
         }
      }
   }

   private registerGlobalMiddleware(): void {
      if (!this.globalConfig) return;

      const middleware = this.createMiddleware(this.globalConfig);

      this.container.setInjection({
         type: INJECTION_TYPES.MIDDLEWARE,
         scope: 'global',
         name: 'cors-global',
         handler: middleware,
         options: this.globalConfig,
         order: 10
      });
   }

   private registerInjector(): void {
      this.container.use({
         name: 'Cors',
         global: true,
         inject: (instance, ctor) => {
            const options = this.controllerConfigs.get(ctor);
            if (options) {
               instance.__corsConfig = this.mergeConfig(options);
            }
         },
      });
   }

   // ============================================================================
   // LIFECYCLE: ACTIVATE
   // ============================================================================

   async activate(): Promise<void> {}

   // ============================================================================
   // LIFECYCLE: READY
   // ============================================================================

   async onReady(): Promise<void> {
      const globalMiddleware = this.container.getInjections<any>(INJECTION_TYPES.MIDDLEWARE);
      const corsGlobal = globalMiddleware.filter(m => m.name === 'cors-global');

      if (corsGlobal.length > 0) {
         this.log.debug('Global CORS enabled');
      }

      if (this.methodCorsCount > 0) {
         this.log.debug(`Route-level CORS: ${this.methodCorsCount} route(s)`);
      }
   }

   // ============================================================================
   // MIDDLEWARE FACTORY
   // ============================================================================

   private createMiddleware(config: CorsOptions): MiddlewareHandler {
      return honoCors({
         origin: config.origin as any,
         allowMethods: config.allowMethods,
         allowHeaders: config.allowHeaders,
         exposeHeaders: config.exposeHeaders,
         maxAge: config.maxAge,
         credentials: config.credentials,
      });
   }

   private createRouteMiddleware(options: CorsDecoratorOptions): MiddlewareHandler {
      if (options.disabled) {
         return async (_ctx: Context, next: Next) => next();
      }
      const mergedConfig = this.mergeConfig(options);
      return this.createMiddleware(mergedConfig);
   }

   // ============================================================================
   // UTILITIES
   // ============================================================================

   private mergeConfig(options: CorsDecoratorOptions): CorsOptions {
      const base = this.globalConfig ?? CorsService.DEFAULT_CONFIG;
      const mappedOptions = this.mapConfigToHono(options);

      return {
         origin: mappedOptions.origin ?? base.origin,
         allowMethods: mappedOptions.allowMethods ?? base.allowMethods,
         allowHeaders: mappedOptions.allowHeaders ?? base.allowHeaders,
         exposeHeaders: mappedOptions.exposeHeaders ?? base.exposeHeaders,
         maxAge: mappedOptions.maxAge ?? base.maxAge,
         credentials: 'credentials' in mappedOptions ? mappedOptions.credentials : base.credentials,
      } as CorsOptions;
   }
}

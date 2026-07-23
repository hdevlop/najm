import { Service, Meta, DI, Container, Inject } from 'najm-core';
import type { LoggerService } from 'najm-core';
import { ScannerService, Scan, ScanType, INJECTION_TYPES, Err, LOGGER } from 'najm-core';
import { RequestParser } from 'najm-core';
import { Context, MiddlewareHandler, Next } from 'hono';
import type { GuardMetadata, GuardPluginConfig } from './types';
import { getGuardMetadata } from './decorator';
import { GUARD_CONFIG } from './tokens';
import { ParamResolver } from 'najm-core';
import { runGuards } from './guardRunner';

@Service()
@Meta({ layer: 'plugin' })
export class GuardService {
   @DI() private container!: Container;
   @Scan() private scanner!: ScannerService;
   @Inject(GUARD_CONFIG) private config!: GuardPluginConfig;
   @Inject(LOGGER) private log!: LoggerService;

   private guardCount = 0;
   private resolver!: ParamResolver;
   private enabled: boolean = true;
   private excludePaths: string[] = [];

   onInit() {
      this.enabled = typeof this.config === 'boolean'
         ? this.config
         : (this.config.enabled ?? true);

      this.excludePaths = typeof this.config === 'object'
         ? (this.config.exclude || [])
         : [];

      this.guardCount = 0;
   }

   async scan(): Promise<void> {
      if (!this.enabled) return;

      this.scanner.scan(ScanType.CONTROLLER, {
         onClass: (controller) => {
            const guards = getGuardMetadata(controller);
            if (guards?.length) {
               this.container.setInjection({
                  type: INJECTION_TYPES.MIDDLEWARE,
                  target: controller,
                  handler: this.createGuardsMiddleware(guards),
                  order: 40,
                  source: 'guard',
               });
               this.guardCount += guards.length;
            }
         },
         onMethod: (controller, methodName) => {
            const guards = getGuardMetadata(controller, methodName);
            if (guards?.length) {
               this.container.setInjection({
                  type: INJECTION_TYPES.MIDDLEWARE,
                  target: controller,
                  methodName,
                  handler: this.createGuardsMiddleware(guards),
                  order: 40,
                  source: 'guard',
               });
               this.guardCount += guards.length;
            }
         }
      });
   }

   async configure(): Promise<void> {
      if (!this.enabled) return;
      this.resolver = new ParamResolver(this.container);
   }

   async activate(): Promise<void> { }

   async onReady(): Promise<void> {
      if (!this.enabled) {
         this.log.debug('Guard plugin disabled');
         return;
      }
      this.log.debug(`Guard plugin ready: ${this.guardCount} guard(s) registered`);
   }

   private createGuardsMiddleware(guards: GuardMetadata[]): MiddlewareHandler {
      return async (context: Context, next: Next) => {
         const path = context.req.path;
         if (this.isPathExcluded(path)) {
            return next();
         }

         try {
            const parser = new RequestParser(context);
            const request = parser.createRequest();
            const store = (this.container as any).all?.() ?? {};

            const allowed = await this.container.run({
               ...store,
               context,
               request,
               parser,
            }, async () => runGuards(guards, this.container, this.resolver, {
               context,
               request,
               parser,
            }));

            if (!allowed) {
               throw Err.unauthorized();
            }
            await next();
         } catch (error) {
            return Err.handle(error);
         }
      };
   }

   private isPathExcluded(path: string): boolean {
      return this.excludePaths.some(pattern => {
         if (pattern === path) return true;

         if (pattern.endsWith('/*')) {
            const prefix = pattern.slice(0, -2);
            return path.startsWith(prefix);
         }

         if (pattern.endsWith('/**')) {
            const prefix = pattern.slice(0, -3);
            return path.startsWith(prefix);
         }

         return false;
      });
   }
}

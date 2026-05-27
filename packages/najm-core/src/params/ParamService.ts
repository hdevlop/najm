import { Service, Meta, DI, Container, Constructor, Inject } from 'diject';
import { Scan, ScannerService, ScanType, INJECTION_TYPES } from '../scanner';
import { LOGGER } from '../server/tokens';
import type { LoggerService } from '../logging';
import type { ParamInjection } from './types';
import { ParamResolver } from './ParamResolver';
import { getParameterMetadata } from './decorators';


@Service()
@Meta({ layer: 'plugin' })
export class ParamService {
   @DI() private container!: Container;
   @Scan() private scanner!: ScannerService;
   @Inject(LOGGER) private log!: LoggerService;

   private resolver!: ParamResolver;
   private paramCount = 0;

   // ============================================================================
   // LIFECYCLE: SCAN
   // ============================================================================

   async scan(): Promise<void> {
      this.paramCount = 0;

      // Scan controllers
      this.scanner.scan(ScanType.CONTROLLER, {
         onMethod: (controller, methodName, handler) => {
            this.registerParamInjection(controller, methodName, handler);
         }
      });

      // Scan guards
      this.scanner.scan(ScanType.GUARD, {
         onMethod: (guard, methodName, handler) => {
            this.registerParamInjection(guard, methodName, handler);
         }
      });
   }

   // ============================================================================
   // PARAM REGISTRATION
   // ============================================================================

   private registerParamInjection( target, methodName, handler) {
      const metadata = getParameterMetadata(handler);

      if (metadata?.length) {
         this.container.setInjection({
            type: INJECTION_TYPES.PARAMS,
            target,
            methodName,
            metadata,
            resolve: () => this.resolver.resolveArgs(handler)
         });
         this.paramCount++;
      }
   }

   // ============================================================================
   // LIFECYCLE: CONFIGURE
   // ============================================================================

   async configure(): Promise<void> {
      this.resolver = new ParamResolver(this.container);
   }

   // ============================================================================
   // LIFECYCLE: ACTIVATE & READY
   // ============================================================================

   async activate(): Promise<void> {}

   async onReady(): Promise<void> {
      const count = this.container.getInjections(INJECTION_TYPES.PARAMS).length;
      this.log.info(`Param plugin ready: ${count} method(s) with parameter injection`);
   }

   // ============================================================================
   // PUBLIC API
   // ============================================================================

   public async resolveMethodParams( controller, methodName, handler): Promise<any[]> {
      const injection = this.container.getInjectionsFor<ParamInjection>(
         INJECTION_TYPES.PARAMS,
         controller,
         methodName
      )[0];

      if (!injection) return [];

      return this.resolver.resolveArgs(handler);
   }

   public getResolver(): ParamResolver {
      return this.resolver;
   }
}

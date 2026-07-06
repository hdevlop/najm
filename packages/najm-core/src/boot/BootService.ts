import type { CoreService } from './types';
import { Container, DI, Meta, Service } from 'diject';
import { LoggerService } from '../logging/LoggerService';

type Phase = 'scan' | 'configure' | 'activate' | 'onReady';

export interface BootTiming {
   service: string;
   phase: Phase;
   ms: number;
}

@Service()
@Meta({ layer: 'boot' })
export class BootService {
   @DI() container!: Container;

   private infrastructure: CoreService[] = [];
   private lifecycleTimings: BootTiming[] = [];
   private readonly slowPhaseThresholdMs = 500;

   // ============================================================================
   // MAIN BOOT SEQUENCE
   // ============================================================================

   async boot(): Promise<void> {
      this.lifecycleTimings = [];

      // Station 1: Boot infrastructure (core + plugins)
      await this.bootInfrastructure();

      // Station 2: Run lifecycle phases
      await this.runLifecycle();

      // Station 3: Boot app services (pure consumers)
      await this.bootAppServices();
   }

   // ============================================================================
   // TEARDOWN
   // ============================================================================

   async destroy(): Promise<void> {
      for (const service of [...this.infrastructure].reverse()) {
         if (typeof service.onDestroy === 'function') {
            await service.onDestroy();
         }
      }
   }

   // ============================================================================
   // STATION 1: BOOT INFRASTRUCTURE
   // ============================================================================

   private async bootInfrastructure(): Promise<void> {
      const coreTokens = this.container.find({ layer: 'core', $sort: { order: 'asc' } });
      const pluginTokens = this.container.find({ layer: 'plugin', $sort: { order: 'asc' } });
      this.infrastructure = await this.container.boot([
         ...coreTokens,
         ...pluginTokens,
      ]);
   }

   // ============================================================================
   // STATION 2: LIFECYCLE
   // ============================================================================

   private async runLifecycle(): Promise<void> {
      const phases: Phase[] = ['scan', 'configure', 'activate', 'onReady'];

      for (const phase of phases) {
         for (const service of this.infrastructure) {
            const method = service[phase];
            if (typeof method === 'function') {
               const started = performance.now();
               await method.call(service);
               const ms = performance.now() - started;
               const serviceName = service.constructor?.name ?? 'AnonymousService';

               this.lifecycleTimings.push({ service: serviceName, phase, ms });
               if (ms >= this.slowPhaseThresholdMs) {
                  this.warnSlowPhase(serviceName, phase, ms);
               }
            }
         }
      }
   }

   // ============================================================================
   // STATION 3: APP SERVICES
   // ============================================================================

   private async bootAppServices(): Promise<void> {
      const appTokens = this.container.find({ layer: 'app' });
      await this.container.boot(appTokens);
   }

   public getTimings(): readonly BootTiming[] {
      return this.lifecycleTimings;
   }

   private warnSlowPhase(serviceName: string, phase: Phase, ms: number): void {
      try {
         const logger = this.container.get(LoggerService);
         logger.warn(`${serviceName}.${phase} took ${Math.round(ms)}ms`);
      } catch {
         // Logger may not be available in isolated low-level BootService tests.
      }
   }
}

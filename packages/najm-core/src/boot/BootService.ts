import type { CoreService } from './types';
import { Container, DI, Meta, Scope, Service, type Token } from 'diject';
import { LoggerService } from '../logging/LoggerService';
import { DECLARED_PLUGIN_SERVICES, DECLARED_PLUGIN_BOOT_SERVICES, DECLARED_APP_SERVICES } from '../server/tokens';

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
   private appServices: CoreService[] = [];
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

   /**
    * Tears down app services, then infrastructure, each in reverse boot order.
    * Safe after a partial boot. A failing onDestroy does not stop the rest;
    * failures are rethrown once everything has been attempted.
    */
   async destroy(): Promise<void> {
      const services = [...new Set([...this.infrastructure, ...this.appServices])].reverse();
      this.infrastructure = [];
      this.appServices = [];

      const errors: unknown[] = [];
      for (const service of services) {
         if (typeof service?.onDestroy !== 'function') continue;
         try {
            await service.onDestroy();
         } catch (error) {
            errors.push(error);
         }
      }

      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) {
         throw new AggregateError(errors, `${errors.length} services failed to tear down`);
      }
   }

   // ============================================================================
   // STATION 1: BOOT INFRASTRUCTURE
   // ============================================================================

   private async bootInfrastructure(): Promise<void> {
      const coreTokens = this.container.find({ layer: 'core', $sort: { order: 'asc' } });
      const declaredPlugins = this.container.has(DECLARED_PLUGIN_SERVICES)
         ? this.container.get(DECLARED_PLUGIN_SERVICES) as Set<Function>
         : undefined;
      const bootPlugins = this.container.has(DECLARED_PLUGIN_BOOT_SERVICES)
         ? this.container.get(DECLARED_PLUGIN_BOOT_SERVICES) as Set<Function>
         : undefined;
      const pluginTokens = this.container.find({ layer: 'plugin', $sort: { order: 'asc' } })
         .filter((token) => (!declaredPlugins || declaredPlugins.has(token as Function)) &&
            (!bootPlugins || bootPlugins.has(token as Function)));
      const infrastructureTokens = [...coreTokens, ...pluginTokens];
      this.infrastructure = [];
      await this.bootTokens(infrastructureTokens, this.infrastructure);
   }

   /**
    * Record successful resolutions immediately: transient instances are not
    * cached in the registry and must remain available after a later failure.
    */
   private async bootTokens(
      tokens: Token[],
      built: CoreService[],
   ): Promise<void> {
      if (!tokens.length) return;
      for (const token of tokens) {
         built.push(await this.container.resolve<CoreService>(token));
      }

      // Preserve diject's onBootComplete notification without resolving the
      // transient services again. Container resolves to the existing container.
      await this.container.boot([Container]);
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
      const declaredApps = this.container.has(DECLARED_APP_SERVICES)
         ? this.container.get(DECLARED_APP_SERVICES) as Set<Function>
         : undefined;
      const appTokens = this.container.find({ layer: 'app' })
         .filter((token) => !declaredApps || declaredApps.has(token as Function));
      const bootableTokens = appTokens.filter(
         (token) => this.container.registry.get(token)?.scope !== Scope.REQUEST,
      );
      this.appServices = [];
      await this.bootTokens(bootableTokens, this.appServices);
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

import type { CoreService } from './types';
import { Container, DI, Meta, Service } from 'diject';

type Phase = 'scan' | 'configure' | 'activate' | 'onReady';

@Service()
@Meta({ layer: 'boot' })
export class BootService {
   @DI() container!: Container;

   private infrastructure: CoreService[] = [];

   // ============================================================================
   // MAIN BOOT SEQUENCE
   // ============================================================================

   async boot(): Promise<void> {
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
               await method.call(service);
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
}

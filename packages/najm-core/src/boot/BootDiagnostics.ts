import { Container, DI, Inject, Meta, Service, type Token } from 'diject';
import { LoggerService } from '../logging/LoggerService';
import { INJECTION_TYPES } from '../scanner';
import type { MiddlewareInjection, RouteEntry } from '../router/types';
import { BootService } from './BootService';

@Service()
@Meta({ layer: 'core', order: 1000 })
export class BootDiagnostics {
   @DI() private container!: Container;
   @Inject(LoggerService) private log!: LoggerService;
   @Inject(BootService) private boot!: BootService;

   async onReady(): Promise<void> {
      this.log.info('Boot diagnostics');
      this.printServices('Core services', this.container.find({ layer: 'core' }));
      this.printServices('Plugin services', this.container.find({ layer: 'plugin' }));
      this.printRouteTable();
      this.printBootTimings();
   }

   private printServices(label: string, tokens: Token[]): void {
      if (!tokens.length) {
         this.log.info(`${label}: none`);
         return;
      }

      this.log.info(`${label} (${tokens.length})`);
      for (const token of tokens) {
         const name = this.getTokenName(token);
         const order = this.container.getMeta(token, 'order') ?? '-';
         const status = this.isBooted(token) ? 'ready' : 'registered';
         this.log.info(`  ${name} (${status}, order: ${order})`);
      }
   }

   private printRouteTable(): void {
      const routes = [...this.container.getInjections<RouteEntry>(INJECTION_TYPES.ROUTE)]
         .sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`));

      if (!routes.length) {
         this.log.info('Routes (0)');
         return;
      }

      this.log.info(`Routes (${routes.length})`);
      for (const route of routes) {
         const method = route.method.toUpperCase().padEnd(6);
         const path = route.path.padEnd(28);
         const target = `${route.target.name}.${String(route.methodName)}`;
         const guards = this.getGuardLabels(route);
         const suffix = guards.length ? ` [${guards.join(', ')}]` : '';
         this.log.info(`  ${method} ${path} ${target}${suffix}`);
      }
   }

   private printBootTimings(): void {
      const timings = this.boot.getTimings();
      if (!timings.length) {
         return;
      }

      this.log.info(`Boot timings (${timings.length})`);
      for (const timing of timings) {
         this.log.info(`  ${timing.service}.${timing.phase}: ${timing.ms.toFixed(2)}ms`);
      }
   }

   private getGuardLabels(route: RouteEntry): string[] {
      const injections = this.container
         .getInjectionsFor<MiddlewareInjection & { name?: string; source?: string }>(
            INJECTION_TYPES.MIDDLEWARE,
            route.target,
         )
         .filter((injection) => !injection.methodName || injection.methodName === route.methodName)
         .filter((injection) => injection.source === 'guard');

      return injections.map((injection) => injection.name ?? 'guard');
   }

   private isBooted(token: Token): boolean {
      const entry = this.container.registry.get(token);
      return !!(entry && typeof entry === 'object' && 'instance' in entry && entry.instance);
   }

   private getTokenName(token: Token): string {
      if (typeof token === 'function') return token.name;
      if (typeof token === 'symbol') return token.description ?? token.toString();
      return String(token);
   }
}

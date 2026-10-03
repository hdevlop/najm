import { Container, FactoryWrapper, Scope, isRegistryEntry, type Token } from 'diject';
import type { CoreService } from './types';

type Owner = { current?: ServiceLifecycle; scopes: WeakMap<object, Scope> };
const owners = new WeakMap<Container, Owner>();

/** Observe successful provider resolutions, including dependencies and lazy services. */
export class ServiceLifecycle {
   private readonly services: CoreService[] = [];
   private readonly seen = new WeakSet<object>();
   private readonly owner: Owner;

   constructor(container: Container) {
      let owner = owners.get(container);
      if (!owner) {
         owner = { scopes: new WeakMap() };
         owners.set(container, owner);
         const resolve = container.resolve.bind(container);
         const slot = owner;
         container.use({
            name: 'NajmServiceLifecycle',
            global: true,
            inject(instance, constructor) {
               const entry = container.registry.get(constructor);
               if (typeof instance?.onDestroy === 'function' && isRegistryEntry(entry)) {
                  slot.scopes.set(instance, entry.scope);
               }
            },
         });

         // Dependencies also resolve through this public method. Recording at
         // completion gives consumers a later position than their dependencies.
         container.resolve = ((token: Token, requestId?: string) => {
            const lifecycle = slot.current;
            const entry = container.registry.get(token);
            const pending = resolve(token, requestId);
            if (!lifecycle || (isRegistryEntry(entry) && entry.scope === Scope.REQUEST)) {
               return pending;
            }
            return pending.then((instance) => {
               // Aliases resolve directly to their target; raw caller-supplied
               // values are not owned providers and must not be torn down here.
               const scope = isRegistryEntry(entry) ? entry.scope : slot.scopes.get(instance);
               if ((scope !== undefined && scope !== Scope.REQUEST)
                  || entry instanceof FactoryWrapper) {
                  lifecycle.record(instance);
               }
               return instance;
            });
         }) as Container['resolve'];
      }
      this.owner = owner;
      owner.current = this;
   }

   private record(service: CoreService): void {
      if (this.owner.current !== this || typeof service?.onDestroy !== 'function' || this.seen.has(service)) return;
      this.seen.add(service);
      this.services.push(service);
   }

   async destroy(): Promise<void> {
      const errors: unknown[] = [];
      try {
         // Keep observing during teardown so a cleanup hook that creates a new
         // owned provider cannot leave it behind. Existing instances stay deduped.
         while (this.services.length) {
            const service = this.services.pop()!;
            try {
               await service.onDestroy!();
            } catch (error) {
               errors.push(error);
            }
         }
      } finally {
         if (this.owner.current === this) this.owner.current = undefined;
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new AggregateError(errors, `${errors.length} services failed to tear down`);
   }
}

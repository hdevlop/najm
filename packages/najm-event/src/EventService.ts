import mitt, { Emitter, Handler } from 'mitt';
import { LoggerService, Scan, ScannerService, ScanType, INJECTION_TYPES } from 'najm-core';
import type { ScanTypeValue } from 'najm-core';
import { Meta, Container, Inject, Constructor, getPropertyInjections, DI, Service } from 'najm-core';
import { getEventListeners } from './decorator';
import { EVENT_SERVICE } from './tokens';
import { EventRegistration } from './types';

@Service()
@Meta({ layer: 'plugin' })
export class EventService {
   @DI() private container!: Container;
   @Scan() private scanner!: ScannerService;
   @Inject(LoggerService) private log!: LoggerService;

   private emitter: Emitter<any> = mitt();
   private eventHandlers = new Map<Constructor, Array<{ eventName: string; handler: Handler<any> }>>();

   // ============================================================================
   // LIFECYCLE: ON INIT (runs immediately after instantiation)
   // ============================================================================

   async onInit(): Promise<void> {
      // Register under symbol token so plugin services resolved after EventService
      // can receive it via standard DI property injection (Pass 1).
      this.container.set(EVENT_SERVICE, this);
   }

   // ============================================================================
   // LIFECYCLE: SCAN
   // ============================================================================

   async scan(): Promise<void> {
      const seen = new Set<Constructor>();

      const scanProviders = (type: ScanTypeValue) => {
         this.scanner.scan(type, {
            onClass: (provider) => {
               if (seen.has(provider)) return;
               seen.add(provider);
               this.scanProvider(provider);
            }
         });
      };

      scanProviders(ScanType.APP);
      scanProviders(ScanType.SERVICE);
      scanProviders(ScanType.CONTROLLER);
   }

   private scanProvider(provider: Constructor): void {
      // Scan for @On() decorated methods
      const listeners = getEventListeners(provider);

      for (const { eventName, methodName } of listeners) {
         this.container.setInjection({
            type: INJECTION_TYPES.EVENT,
            target: provider,
            eventName,
            methodName,
         });
      }

      // Install prototype getter for @Events() on application providers.
      // This allows access to event methods in constructors
      // (before injectProperties runs).
      const propInjections = getPropertyInjections(provider);
      const eventsInjections = propInjections.filter(inj => inj.token === EVENT_SERVICE);

      for (const injection of eventsInjections) {
         this.setupEventsGetter(provider, injection.propertyKey);
      }
   }

   private setupEventsGetter(provider: Constructor, propertyKey: string | symbol): void {
      const eventService = this;

      const createEventsMethods = () => ({
         emit: eventService.emit.bind(eventService),
         emitAsync: eventService.emitAsync.bind(eventService),
         on: eventService.on.bind(eventService),
         off: eventService.off.bind(eventService),
         once: eventService.once.bind(eventService),
         hasListeners: eventService.hasListeners.bind(eventService),
         listenerCount: eventService.listenerCount.bind(eventService),
         eventNames: eventService.eventNames.bind(eventService),
         all: eventService.all.bind(eventService)
      });

      const instanceCache = new WeakMap<object, ReturnType<typeof createEventsMethods>>();

      Object.defineProperty(provider.prototype, propertyKey, {
         configurable: true,
         enumerable: true,
         get() {
            let methods = instanceCache.get(this);
            if (!methods) {
               methods = createEventsMethods();
               instanceCache.set(this, methods);
            }
            return methods;
         },
         set(value) {
            Object.defineProperty(this, propertyKey, {
               configurable: true,
               enumerable: true,
               writable: true,
               value
            });
         }
      });
   }

   // ============================================================================
   // LIFECYCLE: ACTIVATE
   // ============================================================================

   async activate(): Promise<void> {
      const registrations = this.container.getInjections<EventRegistration>(INJECTION_TYPES.EVENT);
      const providersWithHandlers = new Set(registrations.map(r => r.target));

      // Force instantiate all providers with @On() handlers
      for (const provider of providersWithHandlers) {
         await this.container.resolve(provider);
      }

      // Register event handlers
      for (const registration of registrations) {
         await this.registerEventHandler(registration);
      }
   }

   private async registerEventHandler(registration: EventRegistration): Promise<void> {
      const { target, eventName, methodName } = registration;

      if (!this.eventHandlers.has(target)) {
         this.eventHandlers.set(target, []);
      }

      const instance = await this.container.resolve(target);

      const handler = async (data: any) => {
         return instance[methodName]?.(data);
      };

      this.on(eventName, handler);
      this.eventHandlers.get(target)!.push({ eventName, handler });
   }

   // ============================================================================
   // LIFECYCLE: READY
   // ============================================================================

   async onReady(): Promise<void> {
      const count = this.container.getInjections(INJECTION_TYPES.EVENT).length;
      this.log.info(`Event plugin ready: ${count} handler(s) registered`);
   }

   // ============================================================================
   // EVENT EMITTER API
   // ============================================================================

   public emit<T = any>(event: string, data?: T): void {
      this.emitter.emit(event, data);
   }

   public async emitAsync<T = any>(event: string, data?: T): Promise<void> {
      const handlers: any = this.emitter.all.get(event);
      if (!handlers || handlers.size === 0) return;

      const results = await Promise.allSettled(
         [...handlers].map(h => Promise.resolve(h(data)))
      );

      const errors = results
         .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
         .map(r => r.reason);

      if (errors.length > 0) {
         const errorMessage = `${errors.length} handler(s) failed for event "${event}"`;
         this.log.error(errorMessage, errors[0], { event, failedHandlers: errors.length });
         throw new AggregateError(errors, errorMessage);
      }
   }

   public on<T = any>(event: string, handler: Handler<T>): void {
      this.emitter.on(event, handler);
   }

   public off<T = any>(event: string, handler?: Handler<T>): void {
      if (handler) {
         this.emitter.off(event, handler);
      } else {
         this.emitter.all.delete(event);
      }
   }

   public once<T = any>(event: string, handler: Handler<T>): void {
      const onceHandler: Handler<T> = (data) => {
         this.off(event, onceHandler);
         handler(data);
      };
      this.on(event, onceHandler);
   }

   public hasListeners(event: string): boolean {
      const handlers = this.emitter.all.get(event);
      return handlers ? handlers.length > 0 : false;
   }

   public listenerCount(event: string): number {
      const handlers = this.emitter.all.get(event);
      return handlers ? handlers.length : 0;
   }

   public eventNames(): string[] {
      return Array.from(this.emitter.all.keys()) as string[];
   }

   public all() {
      return this.emitter.all;
   }

   // ============================================================================
   // DYNAMIC REGISTRATION
   // ============================================================================

   public async registerProviderEvents(provider: Constructor): Promise<void> {
      if (this.eventHandlers.has(provider)) return;

      const listeners = getEventListeners(provider);
      if (listeners.length === 0) return;

      const instance = await this.container.resolve(provider);
      const handlers: Array<{ eventName: string; handler: Handler<any> }> = [];

      for (const { eventName, methodName } of listeners) {
         const handler = async (data: any) => {
            return instance[methodName]?.(data);
         };

         this.on(eventName, handler);
         handlers.push({ eventName, handler });
      }

      this.eventHandlers.set(provider, handlers);
   }

   public unregisterProviderEvents(provider: Constructor): void {
      const handlers = this.eventHandlers.get(provider);
      if (!handlers) return;

      for (const { eventName, handler } of handlers) {
         this.emitter.off(eventName, handler);
      }

      this.eventHandlers.delete(provider);
   }

   // ============================================================================
   // UTILITIES
   // ============================================================================

   public clear(): void {
      this.eventHandlers.clear();
      this.emitter.all.clear();
   }

   public getStats() {
      const events = this.eventNames();
      const eventCounts: Record<string, number> = {};

      for (const event of events) {
         const count = this.listenerCount(event);
         if (count > 0) {
            eventCounts[event] = count;
         }
      }

      const totalHandlers = Array.from(this.eventHandlers.values())
         .reduce((sum, handlers) => sum + handlers.length, 0);

      return {
         totalProviders: this.eventHandlers.size,
         totalHandlers,
         providers: Array.from(this.eventHandlers.keys()).map(p => p.name),
         events,
         eventCounts
      };
   }
}

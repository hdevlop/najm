
// ============================================================================
// EVENT EMITTER TYPES
// ============================================================================

import { Constructor, InjectionDefinition } from "diject";

export interface EventEmitter {
  emit<T = any>(event: string, data?: T): void;
  emitAsync<T = any>(event: string, data?: T): Promise<void>;
  on<T = any>(event: string, handler: (data: T) => void): void;
  off<T = any>(event: string, handler?: (data: T) => void): void;
  once<T = any>(event: string, handler: (data: T) => void): void;
  hasListeners(event: string): boolean;
  listenerCount(event: string): number;
  eventNames(): string[];
  all(): any;
}

export interface EventRegistration extends InjectionDefinition {
   type: 'event';
   target: Constructor;
   eventName: string;
   methodName: string;
}
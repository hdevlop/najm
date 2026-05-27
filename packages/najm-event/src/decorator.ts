// ============================================================================
// decorators/events.ts
// ============================================================================
import { INJECT_PROPS, MetaHelper } from 'najm-core';
import { EVENTS_META, EVENT_SERVICE } from './tokens';

export function Events(): any {
   return (target: any, propertyKey: string | symbol) => {
      MetaHelper.append(
         INJECT_PROPS,
         {
            propertyKey,
            token: EVENT_SERVICE
         },
         target.constructor
      );
   };
}

export function On(eventName: string): MethodDecorator {
   return (target, method) => {
      MetaHelper.append(
         EVENTS_META,
         { eventName, methodName: method },
         target.constructor
      );
   };
}

export const getEventListeners = (t: any) => MetaHelper.get<any[]>(EVENTS_META, t) ?? [];
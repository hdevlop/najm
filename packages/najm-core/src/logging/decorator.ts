// ============================================================================
// decorators/Log.ts
// ============================================================================
import {  INJECT_PROPS, MetaHelper } from "diject";


export function Log(): PropertyDecorator {
   return (target: any, propertyKey: string | symbol) => {
      MetaHelper.append(
         INJECT_PROPS,
         { propertyKey, token: 'Log' },
         target.constructor
      );
   };
}
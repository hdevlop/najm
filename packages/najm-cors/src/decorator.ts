// ============================================================================
// decorators/cors.ts
// ============================================================================

import { MetaHelper } from "najm-core";
import { CorsDecoratorOptions } from "./types";
import { CORS_META } from "./tokens";

export function Cors(options?: CorsDecoratorOptions): ClassDecorator & MethodDecorator {
   return (target: any, propertyKey?: string | symbol) => {
      const opts = options ?? {};

      if (propertyKey !== undefined) {
         MetaHelper.define(CORS_META, opts, target.constructor, propertyKey as string);
      } else {
         MetaHelper.define(CORS_META, opts, target);
      }
   };
}

export function getCorsOptions(target: any, methodName?: string): CorsDecoratorOptions | undefined {
   return methodName
      ? MetaHelper.get(CORS_META, target, methodName)
      : MetaHelper.get(CORS_META, target);
}
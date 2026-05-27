import { INJECT_PROPS, MetaHelper } from 'najm-core';
import type { I18nDecoratorOptions } from './types';



export function I18n(keyOrPrefix?: string, resolve: boolean = false): any {
   return (target: any, propertyKey: string | symbol) => {
      MetaHelper.append(
         INJECT_PROPS,
         {
            propertyKey,
            token: 'I18n',
            options: {
               prefix: resolve ? undefined : keyOrPrefix,
               resolveKey: resolve ? keyOrPrefix : undefined
            }
         },
         target.constructor
      );
   };
}

/**
 * Helper to retrieve i18n property injections from a class
 */
export function getI18nInjections(target: any): Array<{
   propertyKey: string | symbol;
   token: string;
   options?: I18nDecoratorOptions;
}> {
   const injections = (MetaHelper.get(INJECT_PROPS, target) || []) as any[];
   return injections.filter((inj: any) => inj.token === 'I18n');
}
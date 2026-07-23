// ============================================================================
// scanner/decorator.ts - @Scan decorator for property injection
// ============================================================================

import { Container, MetaHelper } from 'diject';
import { ScannerService } from './ScannerService';

const SCAN_PROPS = Symbol.for('najm:scan:props');

/**
 * Property decorator that injects the ScannerService
 * @example
 * @Service()
 * class MyService {
 *   @Scan() scanner: ScannerService;
 * }
 */
export function Scan(): PropertyDecorator {
   return (target: object, propertyKey: string | symbol) => {
      MetaHelper.append(SCAN_PROPS, propertyKey, target.constructor);
   };
}

/** Alias for @Scan */
export const Sc = Scan;

// ============================================================================
// METADATA HELPER
// ============================================================================

export function getScanProperties(target: Function): (string | symbol)[] {
   return MetaHelper.get<(string | symbol)[]>(SCAN_PROPS, target) || [];
}


/**
 * Register the Scan injector with a container
 * This should be called during bootstrap to enable @Scan injection
 */
export function registerScanInjector(container: Container): void { 
   container.use({
      name: 'Scan',
      global: true,
      inject: async (instance: any, ctor: Function) => {
         const properties = MetaHelper.get<(string | symbol)[]>(SCAN_PROPS, ctor) || [];
         if (properties.length > 0) {
            const scanner = await container.resolve(ScannerService);
            for (const prop of properties) {
               instance[prop] = scanner;
            }
         }
      }
   });
}
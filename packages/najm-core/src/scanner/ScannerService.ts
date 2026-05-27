// ============================================================================
// scanner/ScannerService.ts - Service scanning and introspection
// ============================================================================

import { Container, Service, Meta, Inject, Constructor, DI } from 'diject';
import { ScanType, ScanTypeValue, ScanCallbacks } from './types';
import { registerScanInjector } from './decorator';

// Helper function to check if something is a constructor
function isConstructor(value: any): value is Constructor {
   return typeof value === 'function' && value.prototype !== undefined;
}

// ============================================================================
// SCANNER SERVICE
// ============================================================================

@Service()
@Meta({ layer: 'core' })
export class ScannerService {

   @DI() private container!: Container;

   onInit() {
     registerScanInjector(this.container);
   }

   // =========================================================================
   // UNIFIED FIND
   // =========================================================================

   find(type: ScanTypeValue): Constructor[] {
      const query = this.isLayer(type) ? { layer: type } : { type };
      return this.container.find(query).filter(isConstructor);
   }

   private isLayer(type: ScanTypeValue): boolean {
      return type === ScanType.APP || type === ScanType.PLUGIN || type === ScanType.CORE;
   }

   // =========================================================================
   // UNIFIED SCAN
   // =========================================================================

   scan(type: ScanTypeValue, callbacks: ScanCallbacks): void {
      for (const target of this.find(type)) {
         callbacks.onClass?.(target);

         if (callbacks.onMethod) {
            for (const methodName of this.methods(target)) {
               callbacks.onMethod(target, methodName, target.prototype[methodName]);
            }
         }
      }
   }

   // =========================================================================
   // UTILITIES
   // =========================================================================

   methods(target: Constructor): string[] {
      return Object.getOwnPropertyNames(target.prototype).filter(
         name => name !== 'constructor' && typeof target.prototype[name] === 'function'
      );
   }

   properties(target: Constructor): string[] {
      return Object.getOwnPropertyNames(target.prototype).filter(
         name => name !== 'constructor' && typeof target.prototype[name] !== 'function'
      );
   }

   hasMethod(target: Constructor, methodName: string): boolean {
      return typeof target.prototype[methodName] === 'function';
   }
}
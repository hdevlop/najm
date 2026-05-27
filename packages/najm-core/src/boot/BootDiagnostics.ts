import { Container, DI, Inject, Meta, Service, Token } from 'diject';
import {  SERVER_OPTS } from '../server/tokens';
import { LoggerService } from '../logging/LoggerService';
import { Err } from '../errors';
import { INJECTION_TYPES } from '../scanner';

// ============================================================================
// BOOT DIAGNOSTICS SERVICE
// ============================================================================

interface DiagnosticResult {
   name: string;
   status: 'ok' | 'warning' | 'error';
   message: string;
   details?: any;
}

@Service()
@Meta({ layer: 'core'}) 
export class BootDiagnostics {
   @DI() private container!: Container;
   @Inject(LoggerService) private log!: LoggerService;

   private results: DiagnosticResult[] = [];
   private startTime: number = 0;

   // ============================================================================
   // LIFECYCLE
   // ============================================================================

   async onReady(): Promise<void> {
      this.startTime = performance.now();
      
      console.log('\n' + '='.repeat(60));
      console.log('🔍 BOOT DIAGNOSTICS');
      console.log('='.repeat(60));

      await this.checkCoreTokens();
      await this.checkCoreServices();
      await this.checkPluginServices();
      await this.checkControllers();
      await this.checkRoutes();
      await this.checkInjections();

      this.printSummary();
   }

   // ============================================================================
   // DIAGNOSTIC CHECKS
   // ============================================================================

   private async checkCoreTokens(): Promise<void> {
      console.log('\n📦 Core Tokens:');
      
      const tokens = [
         { token: SERVER_OPTS, name: 'SERVER_OPTS', required: true },
      ];

      for (const { token, name, required } of tokens) {
         const exists = this.container.has(token);
         const value = exists ? this.container.get(token) : undefined;
         const isArray = Array.isArray(value);
         const count = isArray ? value.length : (value ? 1 : 0);

         if (exists) {
            const icon = isArray ? `✅ ${name} (${count} items)` : `✅ ${name}`;
            console.log(`   ${icon}`);
            this.addResult(name, 'ok', 'Token registered', { count });
         } else if (required) {
            console.log(`   ❌ ${name} - MISSING (required)`);
            this.addResult(name, 'error', 'Required token missing');
         } else {
            console.log(`   ⚠️  ${name} - not registered`);
            this.addResult(name, 'warning', 'Optional token not registered');
         }
      }
   }

   private async checkCoreServices(): Promise<void> {
      console.log('\n⚙️  Core Services:');
      
      const coreServices = this.container.find({ layer: 'core' });
      
      if (coreServices.length === 0) {
         console.log('   ❌ No core services found!');
         this.addResult('CoreServices', 'error', 'No core services registered');
         return;
      }

      for (const token of coreServices) {
         const name = this.getTokenName(token);
         const entry = this.container.registry.get(token);
         const isBooted = entry && typeof entry === 'object' && 'instance' in entry && entry.instance;
         
         if (isBooted) {
            const order = this.container.getMeta(token, 'order') ?? '?';
            console.log(`   ✅ ${name} (order: ${order})`);
            this.addResult(name, 'ok', 'Service booted', { order });
         } else {
            console.log(`   ❌ ${name} - NOT BOOTED`);
            this.addResult(name, 'error', 'Service not booted');
         }
      }
   }

   private async checkPluginServices(): Promise<void> {
      console.log('\n🔌 Plugin Services:');
      
      // Find services that are core layer but not in the standard CORE_SERVICES list
      const allCore = this.container.find({ layer: 'core' });
      const plugins = allCore.filter(token => {
         const name = this.getTokenName(token);
         return name.includes('Cors') || 
                name.includes('Plugin') || 
                name.includes('Auth') ||
                name.includes('RateLimit');
      });

      if (plugins.length === 0) {
         console.log('   ℹ️  No plugin services detected');
         return;
      }

      for (const token of plugins) {
         const name = this.getTokenName(token);
         const entry = this.container.registry.get(token);
         const isBooted = entry && typeof entry === 'object' && 'instance' in entry && entry.instance;
         
         if (isBooted) {
            console.log(`   ✅ ${name}`);
            this.addResult(name, 'ok', 'Plugin service booted');
         } else {
            console.log(`   ❌ ${name} - NOT BOOTED`);
            this.addResult(name, 'error', 'Plugin service not booted');
         }
      }
   }

   private async checkControllers(): Promise<void> {
      console.log('\n🎮 Controllers:');
      
      const controllers = this.container.find({ type: 'controller' });
      
      if (controllers.length === 0) {
         console.log('   ⚠️  No controllers registered');
         this.addResult('Controllers', 'warning', 'No controllers found');
         return;
      }

      for (const token of controllers) {
         const name = this.getTokenName(token);
         const path = this.container.getMeta(token, 'path') ?? '/';
         console.log(`   ✅ ${name} → ${path}`);
         this.addResult(name, 'ok', `Controller at ${path}`);
      }
   }

   private async checkRoutes(): Promise<void> {
      console.log('\n🛣️  Routes:');

      const routes = this.container.getInjections<any>(INJECTION_TYPES.ROUTE);
      
      if (routes.length === 0) {
         console.log('   ⚠️  No routes registered');
         this.addResult('Routes', 'warning', 'No routes found');
         return;
      }

      // Group routes by controller
      const byController = new Map<string, any[]>();
      for (const route of routes) {
         const ctrlName = route.controller?.name ?? 'Unknown';
         if (!byController.has(ctrlName)) {
            byController.set(ctrlName, []);
         }
         byController.get(ctrlName)!.push(route);
      }

      for (const [ctrl, ctrlRoutes] of byController) {
         console.log(`   📂 ${ctrl}:`);
         for (const route of ctrlRoutes) {
            const method = (route.method ?? 'GET').toUpperCase().padEnd(6);
            console.log(`      ${method} ${route.path}`);
         }
      }

      this.addResult('Routes', 'ok', `${routes.length} routes registered`);
   }

   private async checkInjections(): Promise<void> {
      console.log('\n💉 Route Injections (CORS, Middleware, etc):');

      const injections = this.container.getInjections<any>(INJECTION_TYPES.MIDDLEWARE);
      
      if (injections.length === 0) {
         console.log('   ℹ️  No route injections configured');
         this.addResult('Injections', 'ok', 'No injections (this is normal if no middleware plugins)');
         return;
      }

      for (const inj of injections) {
         const target = inj.target?.name ?? 'Global';
         const method = inj.methodName ?? '*';
         const type = inj.type ?? 'middleware';
         const hasHandler = !!inj.handler;
         
         if (hasHandler) {
            console.log(`   ✅ ${type} → ${target}.${method}`);
         } else {
            console.log(`   ❌ ${type} → ${target}.${method} (no handler!)`);
            this.addResult(`Injection:${type}`, 'error', 'Injection missing handler');
         }
      }

      this.addResult('Injections', 'ok', `${injections.length} injections configured`);
   }

   // ============================================================================
   // SUMMARY
   // ============================================================================

   private printSummary(): void {
      const duration = (performance.now() - this.startTime).toFixed(2);
      const errors = this.results.filter(r => r.status === 'error');
      const warnings = this.results.filter(r => r.status === 'warning');

      console.log('\n' + '='.repeat(60));
      console.log('📊 BOOT SUMMARY');
      console.log('='.repeat(60));
      console.log(`   ⏱️  Boot diagnostics: ${duration}ms`);
      console.log(`   ✅ OK: ${this.results.filter(r => r.status === 'ok').length}`);
      console.log(`   ⚠️  Warnings: ${warnings.length}`);
      console.log(`   ❌ Errors: ${errors.length}`);

      if (errors.length > 0) {
         console.log('\n🚨 ERRORS:');
         for (const err of errors) {
            console.log(`   ❌ ${err.name}: ${err.message}`);
         }
      }

      if (warnings.length > 0) {
         console.log('\n⚠️  WARNINGS:');
         for (const warn of warnings) {
            console.log(`   ⚠️  ${warn.name}: ${warn.message}`);
         }
      }

      console.log('\n' + '='.repeat(60) + '\n');

      // Throw if critical errors
      if (errors.length > 0) {
         Err(`Boot failed with ${errors.length} error(s). Check diagnostics above.`);
      }
   }

   // ============================================================================
   // HELPERS
   // ============================================================================

   private addResult(name: string, status: DiagnosticResult['status'], message: string, details?: any): void {
      this.results.push({ name, status, message, details });
   }

   private getTokenName(token: Token): string {
      if (typeof token === 'function') return token.name;
      if (typeof token === 'symbol') return token.description ?? token.toString();
      return String(token);
   }
}

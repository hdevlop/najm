// ============================================================================
// PluginRegistry.ts - Plugin registration, dependencies & contributions
// ============================================================================

import { MiddlewareHandler } from 'hono';
import { Container } from 'diject';
import { Err } from '../errors';
import type { NajmPlugin, LazyDependency, Constructor } from './types';

/**
 * Owns the plugin graph for a Server instance: registration with circular
 * dependency detection, auto-registration of NajmPlugin dependencies, lazy
 * dependencies built only when their name is free, deferred validation of
 * string (required) dependencies, and accumulation of cross-plugin
 * contributions.
 */
export class PluginRegistry {
   private readonly plugins = new Map<string, NajmPlugin>();
   private readonly contributions = new Map<symbol, unknown[]>();
   private readonly registeredContributions = new Set<string>();
   private readonly pendingRequirements = new Map<string, Set<string>>();
   private readonly ignoredConfig: string[] = [];

   public has(name: string): boolean {
      return this.plugins.has(name);
   }

   /**
    * Register a plugin with circular dependency detection.
    */
   public register(plugin: NajmPlugin, stack: Set<string> = new Set()): void {
      if (stack.has(plugin.name)) {
         throw Err.circularDependency([...stack, plugin.name]);
      }

      // Already registered - just merge tokens
      if (this.plugins.has(plugin.name)) {
         this.mergePluginTokens(plugin);
         return;
      }

      stack.add(plugin.name);
      this.registerDependencies(plugin, stack);
      this.accumulateContributions(plugin);
      this.plugins.set(plugin.name, plugin);
      stack.delete(plugin.name);
   }

   private registerDependencies(plugin: NajmPlugin, stack: Set<string>): void {
      if (!plugin.dependencies?.length) return;

      for (const dep of plugin.dependencies) {
         if (typeof dep === 'string') {
            // String = required dependency. Validate after all .use() calls and
            // default plugins are registered so plugin order does not matter.
            if (!this.plugins.has(dep)) {
               this.addPendingRequirement(plugin.name, dep);
            }
            continue;
         }

         if (isLazyDependency(dep)) {
            this.registerLazyDependency(plugin.name, dep, stack);
            continue;
         }

         // NajmPlugin = auto-register
         if (!this.plugins.has(dep.name)) {
            this.register(dep, stack);
         }
      }
   }

   /**
    * Build and register a lazy dependency only when its name is free. When it
    * is taken, the dependent's forwarded config for it goes unused; that is
    * recorded for one startup warning instead of being dropped silently.
    */
   private registerLazyDependency(dependent: string, dep: LazyDependency, stack: Set<string>): void {
      if (this.plugins.has(dep.name)) {
         if (dep.forwardedConfig) {
            this.ignoredConfig.push(
               `Plugin "${dependent}" received config for its "${dep.name}" dependency (${dep.forwardedConfig}), `
               + `but a "${dep.name}" plugin is already registered. The registered plugin's config is used; `
               + `remove the forwarded config.`,
            );
         }
         return;
      }

      const created = dep.create();
      if (created?.name !== dep.name) {
         throw new Error(
            `Lazy dependency "${dep.name}" of plugin "${dependent}" created a plugin named "${created?.name}".`,
         );
      }
      this.register(created, stack);
   }

   /**
    * Warnings for forwarded config that registration ignored. Each is
    * returned once.
    */
   public takeIgnoredConfigWarnings(): string[] {
      return this.ignoredConfig.splice(0);
   }

   /**
    * Accumulate contributions (only once per plugin).
    */
   private accumulateContributions(plugin: NajmPlugin): void {
      if (!plugin.contributions?.length) return;
      if (this.registeredContributions.has(plugin.name)) return;

      for (const { token, value } of plugin.contributions) {
         const existing = this.contributions.get(token) ?? [];
         existing.push(value);
         this.contributions.set(token, existing);
      }

      this.registeredContributions.add(plugin.name);
   }

   private mergePluginTokens(plugin: NajmPlugin): void {
      if (!plugin.tokens?.length) return;

      const existing = this.plugins.get(plugin.name);
      if (!existing) return;

      existing.tokens = [...(existing.tokens || []), ...plugin.tokens];
   }

   private addPendingRequirement(pluginName: string, dependency: string): void {
      const requirements = this.pendingRequirements.get(pluginName) ?? new Set<string>();
      requirements.add(dependency);
      this.pendingRequirements.set(pluginName, requirements);
   }

   public validatePendingRequirements(): void {
      if (!this.pendingRequirements.size) return;

      const missing: Array<{ plugin: string; dependency: string }> = [];

      for (const [plugin, dependencies] of this.pendingRequirements) {
         for (const dependency of dependencies) {
            if (!this.plugins.has(dependency)) {
               missing.push({ plugin, dependency });
            }
         }
      }

      if (missing.length) {
         Err.missingDependencies(missing);
      }
   }

   /**
    * Merge server-level `.middleware()` handlers into the middleware plugin config.
    */
   public mergeMiddlewareHandlers(handlers: readonly MiddlewareHandler[]): void {
      if (!handlers.length) return;

      const plugin = this.plugins.get('middleware');
      if (!plugin) return;

      const existingHandlers = plugin.config?.use || [];
      plugin.config = {
         ...plugin.config,
         use: [...existingHandlers, ...handlers],
      };
   }

   /**
    * Set every plugin token, alias, and accumulated contribution on the
    * container, and return the flat list of plugin services to boot.
    */
   public applyTo(container: Container): Constructor[] {
      const services: Constructor[] = [];

      for (const plugin of this.plugins.values()) {
         if (plugin.services?.length) {
            services.push(...plugin.services);
         }

         if (plugin.token && plugin.config !== undefined) {
            container.set(plugin.token, plugin.config);
         }

         if (plugin.tokens?.length) {
            for (const [token, value] of plugin.tokens) {
               container.set(token, value);
            }
         }

         if (plugin.aliases?.length) {
            for (const [token, target] of plugin.aliases) {
               container.alias(token, target);
            }
         }
      }

      for (const [token, values] of this.contributions) {
         container.set(token, values);
      }

      return services;
   }

   /**
    * Constructors targeted by plugin aliases (deduplicated).
    */
   public aliasTargets(): Constructor[] {
      const targets = new Set<Constructor>();
      for (const plugin of this.plugins.values()) {
         for (const [, target] of plugin.aliases ?? []) {
            targets.add(target);
         }
      }
      return [...targets];
   }
}

const isLazyDependency = (dep: NajmPlugin | LazyDependency): dep is LazyDependency =>
   typeof (dep as LazyDependency).create === 'function';

// ============================================================================
// Fluent Plugin Builder
// ============================================================================

import { isInjectable, type Token } from 'diject';
import type { NajmPlugin, Constructor } from './types';

/**
 * Contribution token with type branding for type safety
 */
export type ContributionToken<T> = symbol & { __type?: T };

/**
 * Plugin contribution interface
 */
export interface PluginContribution<T = unknown> {
  token: ContributionToken<T>;
  value: T;
}

/**
 * Fluent plugin builder for creating NajmPlugin instances
 * 
 * @example
 * ```ts
 * export const auth = (opts?: AuthConfig) =>
 *   plugin('auth')
 *     .version('1.0.0')
 *     .depends(cookies(), i18n(), guards())
 *     .requires('database')
 *     .contributes(I18N_CONTRIBUTIONS, AUTH_LOCALES)
 *     .services(AuthService, TokenService)
 *     .config(AUTH_CONFIG, mergeConfig(opts))
 *     .build();
 * ```
 */
class PluginBuilder {
  private _name: string;
  private _version?: string;
  private _deps: (NajmPlugin | string)[] = [];
  private _contributions: PluginContribution[] = [];
  private _services: Constructor[] = [];
  private _token?: Token;
  private _config?: unknown;
  private _tokens: Array<[Token, unknown]> = [];
  private _aliases: Array<[Token, Constructor]> = [];

  constructor(name: string) {
    this._name = name;
  }

  /** Set plugin version */
  version(v: string): this {
    this._version = v;
    return this;
  }

  /** Add auto-register dependencies (plugins) */
  depends(...plugins: NajmPlugin[]): this {
    this._deps.push(...plugins);
    return this;
  }

  /** Add required dependencies (strings - user must register) */
  requires(...names: string[]): this {
    this._deps.push(...names);
    return this;
  }

  /** Add a typed contribution to another plugin */
  contributes<T>(token: ContributionToken<T>, value: T): this {
    this._contributions.push({ token, value });
    return this;
  }

  /** Add services to register */
  services(...items: Array<Constructor | readonly Constructor[] | Record<string, unknown>>): this {
    for (const item of items) {
      if (typeof item === 'function') {
        this._services.push(item);
        continue;
      }

      if (Array.isArray(item)) {
        for (const ctor of item) {
          this._services.push(ctor as Constructor);
        }
        continue;
      }

      for (const exported of Object.values(item)) {
        if (typeof exported === 'function' && isInjectable(exported)) {
          this._services.push(exported as Constructor);
        }
      }
    }

    return this;
  }

  /** Set primary config token and value */
  config<T>(token: Token, value: T): this {
    this._token = token;
    this._config = value;
    return this;
  }

  /** Add additional token-value pair */
  set<T>(token: Token, value: T): this {
    this._tokens.push([token, value]);
    return this;
  }

  /** Add token-to-constructor alias so resolving token instantiates target */
  alias<T>(token: Token, target: Constructor<T>): this {
    this._aliases.push([token, target]);
    return this;
  }

  /** Build the final NajmPlugin object */
  build(): NajmPlugin {
    return {
      name: this._name,
      version: this._version,
      dependencies: this._deps.length ? this._deps : undefined,
      contributions: this._contributions.length ? this._contributions : undefined,
      services: this._services.length ? this._services : undefined,
      token: this._token,
      config: this._config,
      tokens: this._tokens.length ? this._tokens : undefined,
      aliases: this._aliases.length ? this._aliases : undefined,
    };
  }
}

/**
 * Create a new plugin using the fluent builder API
 * 
 * @param name - Plugin name
 * @returns PluginBuilder instance
 * 
 * @example
 * ```ts
 * // Simple plugin
 * export const cookies = () =>
 *   plugin('cookies')
 *     .services(CookiesService)
 *     .build();
 * 
 * // Plugin with config
 * export const i18n = (opts?: I18nConfig) =>
 *   plugin('i18n')
 *     .services(I18nService)
 *     .config(I18N_CONFIG, opts ?? {})
 *     .build();
 * 
 * // Complex plugin with dependencies and contributions
 * export const auth = (opts?: AuthConfig) =>
 *   plugin('auth')
 *     .version('1.0.0')
 *     .depends(cookies(), i18n(), guards())
 *     .requires('database')
 *     .contributes(I18N_CONTRIBUTIONS, AUTH_LOCALES)
 *     .services(AuthService, TokenService)
 *     .config(AUTH_CONFIG, finalConfig)
 *     .build();
 * ```
 */
export const plugin = (name: string): PluginBuilder => new PluginBuilder(name);

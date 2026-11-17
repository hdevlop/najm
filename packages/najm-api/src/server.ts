// ============================================================================
// najm-api - Server preset
// ============================================================================

import { Server, type NajmPlugin, type ServerOpts } from 'najm-core';
import { isProduction } from 'najm-core/env';
import { auth, isAuth, type AuthPluginConfig } from 'najm-auth';
import { cache, redisCacheConfig, type RedisConstructor } from 'najm-cache';
import { cors, type CorsPluginConfig } from 'najm-cors';
import { database, type DatabaseConfig } from 'najm-database';
import {
  email,
  emailConfigFromEnv,
  type EmailConfigFromEnvOptions,
  type EmailEnv,
  type EmailPluginConfig,
} from 'najm-email';
import { events } from 'najm-event';
import { guards, type GuardPluginConfig } from 'najm-guard';
import { i18n, type I18nPluginConfig } from 'najm-i18n';
import { mcp, type McpConfig } from 'najm-mcp';
import { rateLimit, type RateLimitPluginConfig } from 'najm-rate';
import { storage, type StorageConfig } from 'najm-storage';
import { validation, type ValidationPluginConfig } from 'najm-validation';

/**
 * One plugin slot: its options, `false` to leave the plugin out, or a
 * function returning the plugin when the app builds it itself (a wrapper that
 * adds services, for example). It is still registered in the preset's order.
 */
export type NajmServerSlot<T> = T | false | (() => NajmPlugin);

/** Redis when a URL is set (required in production), memory otherwise and always during a build. */
export interface NajmServerCacheOptions {
  /** The Redis URL, read by the app; blank means unset. */
  url?: string;
  /** The ioredis constructor, imported by the app so its bundler includes it. */
  Redis: RedisConstructor;
  keyPrefix?: string;
  /** Default: in production. */
  required?: boolean;
}

/** Rate limits keyed on the client address, read through `trustedProxyHops` trusted proxies. */
export type NajmServerRateLimitOptions = RateLimitPluginConfig & {
  /** Default 1 in production, 0 elsewhere. */
  trustedProxyHops?: number;
};

/** najm-email's config, or the app's literal env reads for `emailConfigFromEnv`. */
export type NajmServerEmailOptions = EmailPluginConfig | (EmailConfigFromEnvOptions & { env: EmailEnv });

export interface NajmServerOptions {
  /** Options for `new Server()`. */
  server?: ServerOpts;
  /** Route prefix, e.g. '/api'. */
  base?: string;
  /** Production policy for cache and rate limits. Default `isProduction()`. */
  production?: boolean;
  /**
   * The process is a build, not a runtime (Next: `isNextBuildPhase()` from
   * najm-next/env): the cache is memory and no Redis server is contacted.
   */
  buildPhase?: boolean;

  cors?: NajmServerSlot<CorsPluginConfig>;
  database?: NajmServerSlot<DatabaseConfig>;
  cache?: NajmServerSlot<NajmServerCacheOptions>;
  i18n?: NajmServerSlot<I18nPluginConfig>;
  validation?: NajmServerSlot<ValidationPluginConfig>;
  rateLimit?: NajmServerSlot<NajmServerRateLimitOptions>;
  /** Registered unless false. */
  events?: boolean | (() => NajmPlugin);
  email?: NajmServerSlot<NajmServerEmailOptions>;
  /**
   * With `auth`, the default is `{ default: [isAuth()] }`: a route that
   * declares no guard asks for sign-in, and `@Public()` opens one. Registered
   * before auth, which would otherwise register guards with no default.
   */
  guards?: NajmServerSlot<GuardPluginConfig>;
  auth?: NajmServerSlot<AuthPluginConfig>;
  mcp?: NajmServerSlot<McpConfig>;
  storage?: NajmServerSlot<StorageConfig>;
  /** The app's own plugins, registered after the preset's, in order. */
  plugins?: NajmPlugin[];
}

function slot<T>(value: NajmServerSlot<T> | undefined, build: (options: T) => NajmPlugin): NajmPlugin | undefined {
  if (value === undefined || value === false) return undefined;
  if (typeof value === 'function') return (value as () => NajmPlugin)();
  return build(value);
}

function cachePlugin(options: NajmServerCacheOptions, production: boolean, buildPhase: boolean) {
  return cache(redisCacheConfig({
    url: options.url,
    Redis: options.Redis,
    keyPrefix: options.keyPrefix,
    required: options.required ?? production,
    buildPhase,
  }));
}

function rateLimitPlugin(options: NajmServerRateLimitOptions, production: boolean) {
  const trustedProxyHops = options.trustedProxyHops ?? (production ? 1 : 0);
  return rateLimit({
    // A local dev server behind no proxy exposes no client address to route
    // handlers; skip there rather than put every request in one bucket.
    skip: !production && trustedProxyHops === 0 ? () => true : undefined,
    onUnresolvedClient: production ? 'shared' : 'skip',
    ...options,
    trustedProxyHops,
  });
}

function emailPlugin(options: NajmServerEmailOptions) {
  if ('env' in options) {
    const { env, ...fromEnv } = options;
    return email(emailConfigFromEnv(env, fromEnv));
  }
  return email(options);
}

/**
 * The plugins most Najm APIs register, in the order they depend on each
 * other, with the policy every app would otherwise write itself:
 *
 * cors, database, cache, i18n, validation, rateLimit, events, email,
 * guards, auth, mcp, storage, then `plugins`.
 *
 * Options are values, never environment lookups: the app reads its own
 * variables and passes them in. Each plugin is built when this is called, so
 * call it once per server.
 *
 * ```ts
 * export const server = createNajmServer({
 *   base: '/api',
 *   database: { default: db },
 *   cache: { url: process.env.REDIS_URL, Redis, keyPrefix: 'app:' },
 *   rateLimit: {},
 *   email: { env: { EMAIL_PROVIDER: process.env.EMAIL_PROVIDER }, defaultProvider: 'console' },
 *   auth: { dialect: 'pg' },
 * }).load(modules);
 * ```
 */
export function createNajmServer(options: NajmServerOptions = {}): Server {
  const production = options.production ?? isProduction();
  const buildPhase = options.buildPhase ?? false;
  const guardConfig = options.guards ?? (options.auth ? { default: [isAuth()] } : undefined);

  const plugins = [
    slot(options.cors, config => cors(config)),
    slot(options.database, config => database(config)),
    slot(options.cache, config => cachePlugin(config, production, buildPhase)),
    slot(options.i18n, config => i18n(config)),
    slot(options.validation, config => validation(config)),
    slot(options.rateLimit, config => rateLimitPlugin(config, production)),
    options.events === false ? undefined : typeof options.events === 'function' ? options.events() : events(),
    slot(options.email, emailPlugin),
    slot(guardConfig, config => guards(config)),
    slot(options.auth, config => auth(config)),
    slot(options.mcp, config => mcp(config)),
    slot(options.storage, config => storage(config)),
    ...(options.plugins ?? []),
  ].filter((plugin): plugin is NajmPlugin => plugin !== undefined);

  const server = new Server(options.server);
  for (const plugin of plugins) server.use(plugin);
  if (options.base) server.base(options.base);
  return server;
}

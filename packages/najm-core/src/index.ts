// ============================================================================
// najm-core - Main Framework Exports
// ============================================================================

export { Server, plugin, handle } from './server';
export type { ContributionToken, PluginContribution } from './server';
export type { NajmPlugin, ServerOpts, Loadable, ScanTarget } from './server/types';
export { SERVER_OPTS, APP, BASE_PATH, LOGGER } from './server/tokens';

// ============================================================================
// Logging Module
// ============================================================================
export { LoggerService, Log } from './logging';
export type { LoggerConfig, LogEntry, ILogger, LogLevel } from './logging/types';
// ============================================================================
// Errors Module
// ============================================================================
export * from './errors';

// ============================================================================
// Boot Module - ALS Tokens
// ============================================================================
export { BootService } from './boot';
export { REQUEST_ID } from './boot/alsTokens';

// ============================================================================
// Scanner Module
// ============================================================================
export { ScannerService, Scan, registerScanInjector } from './scanner';
export { ScanType, INJECTION_TYPES } from './scanner';
export type { ScanTypeValue, ScanCallbacks, InjectionType } from './scanner';

// ============================================================================
// Merged Plugins
// ============================================================================
export * from './params';
export * from './router';
export * from './middleware';
export * from './resolution';

// ============================================================================
// DI Re-Exports (single-source diject runtime)
// ============================================================================
export {
  Container,
  container,
  reset,
  Scope,
  Injectable,
  Service,
  Controller,
  Repository,
  Inject,
  DI,
  Meta,
  MetaHelper,
  createAlsToken,
  getPropertyInjections,
  getParameterInjections,
  getPath,
  getDatabase,
  isInjectable,
  isRepository,
} from 'diject';
export {
  INJECT_PROPS,
  DIError,
} from 'diject';
export type {
  Constructor,
  InjectionDefinition,
  Token,
} from 'diject';

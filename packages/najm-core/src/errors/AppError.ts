import { BaseError } from "diject";

export const CORE_CODES = {
  // Server Lifecycle
  INIT_FAILED: "CORE_001",
  START_FAILED: "CORE_002",
  STOP_FAILED: "CORE_003",
  ALREADY_RUNNING: "CORE_004",
  NOT_RUNNING: "CORE_005",
  ALREADY_INITIALIZED: "CORE_006",
  NOT_INITIALIZED: "CORE_007",
  // Configuration
  INVALID_CONFIG: "CORE_010",
  MISSING_CONFIG: "CORE_011",
  CONFIG_REQUIRED: "CORE_012",
  // Service
  SERVICE_REGISTRATION_FAILED: "CORE_020",
  SERVICE_NOT_FOUND: "CORE_021",
  SERVICE_INIT_FAILED: "CORE_022",
  DUPLICATE_SERVICE: "CORE_023",
  // Plugin
  PLUGIN_LOAD_FAILED: "CORE_030",
  PLUGIN_INIT_FAILED: "CORE_031",
  PLUGIN_NOT_FOUND: "CORE_032",
  CIRCULAR_DEPENDENCY: "CORE_033",
  MISSING_DEPENDENCY: "CORE_034",
  UNKNOWN_PLUGIN: "CORE_035",
  // Contribution
  INVALID_CONTRIBUTION: "CORE_040",
  // General
  INTERNAL_ERROR: "CORE_050",
  INVALID_OPERATION: "CORE_051",
} as const;

const getTokenName = (target: any): string => {
  if (typeof target === "function") return target.name || "Anonymous";
  if (typeof target === "symbol") return target.description ?? target.toString();
  if (typeof target === "string") return target;
  return String(target);
};

const getCauseMessage = (cause: unknown): string | undefined => {
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === "string" && cause.trim()) return cause;
  return undefined;
};

const withCause = (error: BaseError, cause?: unknown): BaseError => {
  if (cause !== undefined) {
    (error as BaseError & { cause?: unknown }).cause = cause;
  }
  return error;
};

export const CoreError = {
  // Server Lifecycle
  initFailed: (reason: string): never => {
    throw new BaseError(CORE_CODES.INIT_FAILED, `Failed to initialize: ${reason}`, 500);
  },

  startFailed: (port: number, cause?: unknown): never => {
    const causeMessage = getCauseMessage(cause);
    const message = causeMessage
      ? `Failed to start server on port ${port}: ${causeMessage}`
      : `Failed to start server on port ${port}`;

    throw withCause(new BaseError(CORE_CODES.START_FAILED, message, 500), cause);
  },

  stopFailed: (): never => {
    throw new BaseError(CORE_CODES.STOP_FAILED, "Failed to stop server", 500);
  },

  alreadyRunning: (port?: number): never => {
    const message = port ? `Server already running on port ${port}` : "Server already running";
    throw new BaseError(CORE_CODES.ALREADY_RUNNING, message, 500);
  },

  notRunning: (operation: string): never => {
    throw new BaseError(CORE_CODES.NOT_RUNNING, `Cannot ${operation}: Server is not running`, 500);
  },

  alreadyInitialized: (): never => {
    throw new BaseError(CORE_CODES.ALREADY_INITIALIZED, "Already initialized", 500);
  },

  notInitialized: (operation: string): never => {
    throw new BaseError(CORE_CODES.NOT_INITIALIZED, `Cannot ${operation}: Not initialized`, 500);
  },

  // Configuration
  invalidConfig: (field: string, reason: string): never => {
    throw new BaseError(CORE_CODES.INVALID_CONFIG, `Invalid configuration for "${field}": ${reason}`, 500);
  },

  missingConfig: (field: string): never => {
    throw new BaseError(CORE_CODES.MISSING_CONFIG, `Missing required configuration: "${field}"`, 500);
  },

  configRequired: (plugin: string, key: string): never => {
    throw new BaseError(CORE_CODES.CONFIG_REQUIRED, `Plugin "${plugin}" requires configuration: ${key}`, 500);
  },

  // Service
  serviceRegistrationFailed: (service: any): never => {
    const name = getTokenName(service);
    throw new BaseError(CORE_CODES.SERVICE_REGISTRATION_FAILED, `Failed to register service: ${name}`, 500);
  },

  serviceNotFound: (service: any): never => {
    const name = getTokenName(service);
    throw new BaseError(CORE_CODES.SERVICE_NOT_FOUND, `Service not found: ${name}`, 500);
  },

  serviceInitFailed: (service: any): never => {
    const name = getTokenName(service);
    throw new BaseError(CORE_CODES.SERVICE_INIT_FAILED, `Failed to initialize service: ${name}`, 500);
  },

  duplicateService: (service: any): never => {
    const name = getTokenName(service);
    throw new BaseError(CORE_CODES.DUPLICATE_SERVICE, `Service already registered: ${name}`, 500);
  },

  // Plugin
  pluginLoadFailed: (pluginName: string): never => {
    throw new BaseError(CORE_CODES.PLUGIN_LOAD_FAILED, `Failed to load plugin: ${pluginName}`, 500);
  },

  pluginInitFailed: (pluginName: string): never => {
    throw new BaseError(CORE_CODES.PLUGIN_INIT_FAILED, `Failed to initialize plugin: ${pluginName}`, 500);
  },

  pluginNotFound: (pluginName: string): never => {
    throw new BaseError(CORE_CODES.PLUGIN_NOT_FOUND, `Plugin not found: ${pluginName}`, 500);
  },

  circularDependency: (cycle: string[]): never => {
    const cycleStr = cycle.join(' → ');
    throw new BaseError(CORE_CODES.CIRCULAR_DEPENDENCY, `Circular dependency detected: ${cycleStr}`, 500);
  },

  missingDependency: (plugin: string, dependency: string): never => {
    throw new BaseError(CORE_CODES.MISSING_DEPENDENCY, `Plugin "${plugin}" requires "${dependency}" to be registered first`, 500);
  },

  unknownPlugin: (name: string): never => {
    throw new BaseError(CORE_CODES.UNKNOWN_PLUGIN, `Unknown plugin: "${name}"`, 500);
  },

  // Contribution
  invalidContribution: (plugin: string, message: string): never => {
    throw new BaseError(CORE_CODES.INVALID_CONTRIBUTION, `Invalid contribution from "${plugin}": ${message}`, 500);
  },

  // General
  internal: (message: string): never => {
    throw new BaseError(CORE_CODES.INTERNAL_ERROR, message, 500);
  },

  invalidOperation: (message: string): never => {
    throw new BaseError(CORE_CODES.INVALID_OPERATION, message, 500);
  },
};

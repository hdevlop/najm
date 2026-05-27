// Logging Module Types

// ============================================================================
// LOG LEVEL ENUM
// ============================================================================

export enum LogLevel {
   DEBUG = 0,
   INFO = 1,
   WARN = 2,
   ERROR = 3,
   SILENT = 4,
}

// ============================================================================
// LOGGING TYPES
// ============================================================================

export interface LoggerConfig {
   level?: LogLevel | keyof typeof LogLevel;
   format?: 'pretty' | 'json';
   includeTimestamp?: boolean;
   includeRequestId?: boolean;
   colors?: boolean;
}

export interface LogEntry {
   level: string;
   message: string;
   timestamp?: string;
   requestId?: string;
   context?: Record<string, any>;
   error?: any;
}

export interface ILogger {

   debug(message: string, context?: Record<string, any>): void;
   info(message: string, context?: Record<string, any>): void;
   warn(message: string, context?: Record<string, any>): void;
   error(message: string, error?: any, context?: Record<string, any>): void;
   child(defaultContext: Record<string, any>): ILogger;
   setLevel(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT'): void;
   getLevel(): number;
   setFormat(format: 'pretty' | 'json'): void;
   getFormat(): 'pretty' | 'json';
}
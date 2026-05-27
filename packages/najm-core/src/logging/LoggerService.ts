
import { REQUEST_ID } from '../boot/alsTokens';
import { ServerLog } from './ServerLog';
import { SERVER_OPTS } from '../boot';
import type { LogEntry, LoggerConfig } from './types';
import { LogLevel } from './types';
import { type ServerOpts } from '../server/types';
import { Container, Inject, Meta, Service } from 'diject';

// ============================================================================
// FACTORY
// ============================================================================

export function createLogger(): LoggerService {
   return new LoggerService();
}

// ============================================================================
// SERVICE
// ============================================================================

@Service()
@Meta({ layer: 'core' })
export class LoggerService extends ServerLog {
   @Inject(Container) private container!: Container;
   @Inject(SERVER_OPTS) private opts!: ServerOpts;

   private level!: LogLevel;
   private format!: 'pretty' | 'json';
   private includeTimestamp!: boolean;
   private includeRequestId!: boolean;
   private colors!: boolean;
 
   private readonly colorMap = {
      DEBUG: '\x1b[36m',
      INFO: '\x1b[32m',
      WARN: '\x1b[33m', 
      ERROR: '\x1b[31m',
      RESET: '\x1b[0m',
   }; 
   private injectorRegistered = false;

   async onInit(): Promise<void> {
      this.parseConfig();
      this.registerInjector();
   }

   // ============================================================================
   // LIFECYCLE: SCAN
   // ============================================================================

   async scan(): Promise<void> {}

   // ============================================================================
   // LIFECYCLE: CONFIGURE
   // ============================================================================

   async configure(): Promise<void> {
      this.parseConfig(); 
      this.registerInjector();
   }

   private parseConfig(): void {
      const config = this.opts?.logger || this.getDefaultConfig();

      this.level = this.parseLogLevel(config.level);
      this.format = config.format ?? (process.env.NODE_ENV === 'production' ? 'json' : 'pretty');
      this.includeTimestamp = config.includeTimestamp ?? true;
      this.includeRequestId = config.includeRequestId ?? true;
      this.colors = config.colors ?? (process.env.NODE_ENV !== 'production');

      if (this.opts?.silent) {
         this.level = LogLevel.SILENT;
      }
   }

   private getDefaultConfig(): LoggerConfig { 
      return {
         level: process.env.LOG_LEVEL as keyof typeof LogLevel || 'INFO',
         format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
         includeTimestamp: true,
         includeRequestId: true,
         colors: process.env.NODE_ENV !== 'production',
      };
   }

   private registerInjector(): void {
      if (this.injectorRegistered) {
         return;
      }

      this.container.use({
         name: 'Logger',
         global: true,
         inject: (instance) => {
            // Skip LoggerService itself to avoid overwriting its private log method
            if (instance instanceof LoggerService) return;
            if ('log' in instance) return;
            instance.log = this;
         }
      });

      this.container.use({
         name: 'Log',
         global: true,
         inject: (instance, _ctor, _registry, injections) => {
            if (!injections) return;
            const logInjections = injections.filter(inj => inj.token === 'Log');
            for (const injection of logInjections) {
               const { propertyKey } = injection;
               instance[propertyKey] = this;
            }
         }
      });

      this.injectorRegistered = true;
   }

   // ============================================================================
   // LIFECYCLE: ACTIVATE & READY
   // ============================================================================

   async activate(): Promise<void> { }

   async onReady(): Promise<void> { }

   // ============================================================================
   // CORE LOGGING METHODS
   // ============================================================================

   public debug(message: string, context?: Record<string, any>): void {
      this.log(LogLevel.DEBUG, message, context);
   }

   public info(message: string, context?: Record<string, any>): void {
      this.log(LogLevel.INFO, message, context);
   }

   public warn(message: string, context?: Record<string, any>): void {
      this.log(LogLevel.WARN, message, context);
   }

   public error(message: string, error?: any, context?: Record<string, any>): void {
      this.log(LogLevel.ERROR, message, { ...context, error });
   }

   private log(level: LogLevel, message: string, context?: Record<string, any>): void {
      if (level < this.level) return;

      const entry = this.createLogEntry(level, message, context);
      const formatted = this.formatLog(entry, level);

      this.write(level, formatted);
   }

   // ============================================================================
   // LOG ENTRY CREATION
   // ============================================================================

   private createLogEntry(level: LogLevel, message: string, context?: Record<string, any>): LogEntry {
      const entry: LogEntry = {
         level: LogLevel[level],
         message,
      };

      if (this.includeTimestamp) {
         entry.timestamp = new Date().toISOString();
      }

      if (this.includeRequestId && this.container && this.container.isActive()) {
         const requestId = this.container.get(REQUEST_ID);
         if (requestId) {
            entry.requestId = requestId;
         }
      }

      if (context) {
         const { error, ...rest } = context;
         if (Object.keys(rest).length > 0) {
            entry.context = rest;
         }
         if (error) {
            entry.error = this.serializeError(error);
         }
      }

      return entry;
   }

   private serializeError(error: any): any {
      if (error instanceof Error) {
         return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...error,
         };
      }
      return error;
   }

   // ============================================================================
   // FORMATTING
   // ============================================================================

   private formatLog(entry: LogEntry, level: LogLevel): string {
      if (this.format === 'json') {
         return JSON.stringify(entry);
      }

      return this.formatPretty(entry, level);
   }

   private formatPretty(entry: LogEntry, level: LogLevel): string {
      const parts: string[] = [];

      if (entry.timestamp) {
         parts.push(`[${entry.timestamp}]`);
      }

      const levelStr = this.colors
         ? `${this.colorMap[entry.level as keyof typeof this.colorMap]}${entry.level}${this.colorMap.RESET}`
         : entry.level;
      parts.push(`[${levelStr}]`);

      if (entry.requestId) {
         parts.push(`[${entry.requestId.substring(0, 8)}]`);
      }

      parts.push(entry.message);

      let result = parts.join(' ');

      if (entry.context && Object.keys(entry.context).length > 0) {
         result += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
      }

      if (entry.error) {
         result += `\n  Error: ${JSON.stringify(entry.error, null, 2)}`;
      }

      return result;
   }

   // ============================================================================
   // OUTPUT
   // ============================================================================

   private write(level: LogLevel, message: string): void {
      if (level >= LogLevel.ERROR) {
         console.error(message);
      } else {
         console.log(message);
      }
   }

   // ============================================================================
   // CONFIGURATION
   // ============================================================================

   public setLevel(level: LogLevel | keyof typeof LogLevel): void {
      this.level = this.parseLogLevel(level);
   }

   public getLevel(): LogLevel {
      return this.level;
   }

   public setFormat(format: 'pretty' | 'json'): void {
      this.format = format;
   }

   public getFormat(): 'pretty' | 'json' {
      return this.format;
   }

   private parseLogLevel(level?: LogLevel | keyof typeof LogLevel): LogLevel {
      if (level === undefined) return LogLevel.INFO;

      if (typeof level === 'number') {
         return level;
      }

      return LogLevel[level as keyof typeof LogLevel] ?? LogLevel.INFO;
   }

   // ============================================================================
   // CHILD LOGGER
   // ============================================================================

   public child(defaultContext: Record<string, any>): ChildLogger {
      return new ChildLogger(this, defaultContext);
   }
}

// ============================================================================
// CHILD LOGGER
// ============================================================================

class ChildLogger {
   constructor(
      private readonly parent: LoggerService,
      private readonly defaultContext: Record<string, any>,
   ) { }

   public debug(message: string, context?: Record<string, any>): void {
      this.parent.debug(message, { ...this.defaultContext, ...context });
   }

   public info(message: string, context?: Record<string, any>): void {
      this.parent.info(message, { ...this.defaultContext, ...context });
   }

   public warn(message: string, context?: Record<string, any>): void {
      this.parent.warn(message, { ...this.defaultContext, ...context });
   }

   public error(message: string, error?: any, context?: Record<string, any>): void {
      this.parent.error(message, error, { ...this.defaultContext, ...context });
   }

   public child(additionalContext: Record<string, any>): ChildLogger {
      return new ChildLogger(this.parent, { ...this.defaultContext, ...additionalContext });
   }
}


import { REQUEST_ID } from '../boot/alsTokens';
import { ServerLog } from './ServerLog';
import { SERVER_OPTS } from '../server/tokens';
import type { LogEntry, LoggerConfig } from './types';
import { LogLevel } from './types';
import { type ServerOpts } from '../server/types';
import { Container, Inject, Meta, Service } from 'diject';

// ============================================================================
// FACTORY
// ============================================================================

export function createLogger(config?: LoggerConfig, silent = false): LoggerService {
   return new LoggerService(config, silent);
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
   private readonly overrideConfig?: LoggerConfig;
   private readonly overrideSilent: boolean;
 
   private readonly colorMap = {
      DEBUG: '\x1b[36m',
      INFO: '\x1b[32m',
      WARN: '\x1b[33m',
      ERROR: '\x1b[31m',
      RESET: '\x1b[0m',
   };
   private readonly DIM = '\x1b[2m';
   private readonly iconMap = {
      DEBUG: '◆',
      INFO: 'ℹ',
      WARN: '⚠',
      ERROR: '✖',
   };
   private injectorRegistered = false;

   constructor(config?: LoggerConfig, silent = false) {
      super();
      this.overrideConfig = config;
      this.overrideSilent = silent;
      // Standalone loggers (createLogger(), pre-boot Server logging) never go
      // through onInit/configure, so derive env defaults now; DI boot re-parses
      // later with SERVER_OPTS applied.
      this.parseConfig();
   }

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
      const config = this.opts?.logger ?? this.overrideConfig ?? this.getDefaultConfig();

      this.level = this.parseLogLevel(config.level);
      this.format = config.format ?? this.resolveDefaultFormat();
      this.includeTimestamp = config.includeTimestamp ?? true;
      this.includeRequestId = config.includeRequestId ?? true;
      this.colors = config.colors ?? this.resolveDefaultColors();

      if (this.opts?.silent || this.overrideSilent) {
         this.level = LogLevel.SILENT;
      }
   }

   private getDefaultConfig(): LoggerConfig { 
      return {
         level: process.env.LOG_LEVEL as keyof typeof LogLevel || 'INFO',
         format: this.resolveDefaultFormat(),
         includeTimestamp: true,
         includeRequestId: true,
         colors: this.resolveDefaultColors(),
      };
   }

   private resolveDefaultFormat(): 'pretty' | 'json' {
      return (process.env.LOG_FORMAT as 'pretty' | 'json' | undefined)
         ?? (process.env.NODE_ENV === 'production' ? 'json' : 'pretty');
   }

   private resolveDefaultColors(): boolean {
      if (process.env.NO_COLOR) {
         return false;
      }

      return process.env.NODE_ENV !== 'production';
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
         return JSON.stringify({
            ...entry,
            message: this.stripMessageIcon(entry.message),
         });
      }

      return this.formatPretty(entry, level);
   }

   private stripMessageIcon(message: string): string {
      return message.replace(/^(?:[\u{1F680}\u{1F6D1}\u{2699}\u{2705}\u{274C}\u{1F3A8}\u{1F4DA}]\uFE0F?\s*)+/u, '');
   }

   private formatPretty(entry: LogEntry, level: LogLevel): string {
      const levelKey = entry.level as keyof typeof this.colorMap;
      const color = this.colors ? this.colorMap[levelKey] ?? '' : '';
      const reset = this.colors ? this.colorMap.RESET : '';
      const dim = this.colors ? this.DIM : '';

      const icon = this.iconMap[entry.level as keyof typeof this.iconMap] ?? '•';
      const parts: string[] = [];

      // Per-line time is noise on a fast boot where everything shares the same
      // second. Kept in the entry (and JSON output) but only rendered in pretty
      // mode when explicitly opted in via LOG_TIME.
      if (entry.timestamp && process.env.LOG_TIME) {
         parts.push(`${dim}${entry.timestamp.slice(11, 19)}${reset}`);
      }

      // Colored icon + fixed-width level label so messages stay aligned.
      parts.push(`${color}${icon} ${entry.level.padEnd(5)}${reset}`);

      if (entry.requestId) {
         parts.push(`${dim}${entry.requestId.substring(0, 8)}${reset}`);
      }

      parts.push(entry.message);

      let result = parts.join(' ');

      if (entry.context && Object.keys(entry.context).length > 0) {
         result += `\n  ${dim}Context:${reset} ${JSON.stringify(entry.context, null, 2)}`;
      }

      if (entry.error) {
         result += `\n${this.formatError(entry.error, color, reset, dim)}`;
      }

      return result;
   }

   private formatError(error: any, color: string, reset: string, dim: string): string {
      // Structured error (name/message/stack) → header line + dimmed stack frames
      // with real newlines, instead of an escaped JSON blob.
      if (error && typeof error === 'object' && (error.stack || error.message)) {
         const name = error.name ?? 'Error';
         const head = `  ${color}${name}${reset}: ${error.message ?? ''}`;

         if (typeof error.stack === 'string') {
            const frames = error.stack
               .split('\n')
               .slice(1) // first line repeats "Name: message"
               .map((line: string) => `  ${dim}${line.trimEnd()}${reset}`);
            return [head, ...frames].join('\n');
         }
         return head;
      }

      const text = typeof error === 'string' ? error : JSON.stringify(error);
      return `  ${color}Error:${reset} ${text}`;
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

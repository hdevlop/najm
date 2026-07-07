// src/server/logging/ServerLog.ts

export interface ServerStartedInfo {
   port: number;
   basePath?: string;
   env?: string;
   runtime?: string;
   pid?: number;
   version?: string;
}

export abstract class ServerLog {
   // Abstract methods to be implemented by LoggerService
   protected abstract info(message: string, context?: Record<string, any>): void;
   protected abstract warn(message: string, context?: Record<string, any>): void;
   protected abstract error(message: string, error?: any, context?: Record<string, any>): void;
   protected abstract debug(message: string, context?: Record<string, any>): void;

   // ============================================================================
   // SERVER LIFECYCLE
   // ============================================================================

   serverStarted(info: number | ServerStartedInfo): void {
      this.info('🚀 Server started successfully', typeof info === 'number' ? { port: info } : info);
   }

   serverStopped(): void {
      this.info('🛑 Server stopped gracefully');
   }

   serverInitializing(): void {
      this.info('⚙️ Initializing server...');
   }

   serverInitialized(ms?: number): void {
      this.info(ms === undefined
         ? '✅ Server initialized successfully'
         : `✅ Server initialized in ${Math.round(ms)}ms`);
   }

   serverError(error: any): void {
      this.error('❌ Server encountered an error', error);
   }

   serverShutdown(reason: string): void {
      this.warn('Server shutting down', { reason });
   }

   serverAlreadyRunning(port?: number): void {
      this.warn('Server already running', port ? { port } : undefined);
   }

   serverNotRunning(): void {
      this.warn('Server is not running');
   }

   serverlessModeEnabled(): void {
      this.info('Serverless mode enabled');
   }

   // ============================================================================
   // DATABASE
   // ============================================================================

   databaseConnected(name: string): void {
      this.info('Database connected', { database: name });
   }

   databaseDisconnected(name: string): void {
      this.info('Database disconnected', { database: name });
   }

   databaseError(name: string, error: any): void {
      this.error('Database error', error, { database: name });
   }

   databaseQuerySlow(query: string, duration: number): void {
      this.warn('Slow database query detected', {
         query: query.substring(0, 100),
         duration: `${duration}ms`
      });
   }

   databaseNotFound(name: string): void {
      this.warn('Database not found', { database: name });
   }

   databaseAlreadyRegistered(name: string): void {
      this.warn('Database already registered, overwriting', { database: name });
   }

   databaseDisconnectFailed(name: string, error: any): void {
      this.error('Failed to disconnect database', error, { database: name });
   }

   // ============================================================================
   // TRANSACTION
   // ============================================================================

   transactionStarted(database: string): void {
      this.debug('Transaction started', { database });
   }

   transactionCommitted(database: string): void {
      this.debug('Transaction committed', { database });
   }

   transactionRolledBack(database: string, reason?: string): void {
      this.warn('Transaction rolled back', { database, reason });
   }

   transactionRetry(database: string, attempt: number, maxAttempts: number, reason: string): void {
      this.warn('Transaction retry', {
         database,
         attempt,
         maxAttempts,
         reason
      });
   }

   transactionFailed(database: string, error: any): void {
      this.error('Transaction failed', error, { database });
   }
   // ============================================================================
   // PLUGIN
   // ============================================================================

   pluginRegistered(name: string): void {
      this.info('Plugin registered', { plugin: name });
   }

   pluginUnregistered(name: string): void {
      this.info('Plugin unregistered', { plugin: name });
   }

   pluginError(name: string, error: any): void {
      this.error('Plugin error', error, { plugin: name });
   }

   pluginInitialized(name: string, duration: number): void {
      this.debug('Plugin initialized', { plugin: name, duration: `${duration}ms` });
   }

   // ============================================================================
   // CONTAINER / DI
   // ============================================================================

   serviceRegistered(name: string): void {
      this.debug('Service registered', { service: name });
   }

   serviceResolved(name: string, scope: string): void {
      this.debug('Service resolved', { service: name, scope });
   }

   circularDependency(chain: string[]): void {
      this.error('Circular dependency detected', undefined, {
         dependencyChain: chain.join(' -> ')
      });
   }

   dependencyInjectionError(name: string, error: any): void {
      this.error('Dependency injection failed', error, { service: name });
   }

   // ============================================================================
   // REQUEST / RESPONSE
   // ============================================================================

   requestReceived(method: string, path: string): void {
      this.debug('Request received', { method, path });
   }

   requestCompleted(method: string, path: string, status: number, duration: number): void {
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      this[level]('Request completed', { method, path, status, duration: `${duration}ms` });
   }

   requestError(method: string, path: string, error: any): void {
      this.error('Request failed', error, { method, path });
   }

   // ============================================================================
   // MIDDLEWARE
   // ============================================================================

   middlewareRegistered(name: string): void {
      this.debug('Middleware registered', { middleware: name });
   }

   middlewareError(name: string, error: any): void {
      this.error('Middleware error', error, { middleware: name });
   }

   // ============================================================================
   // CORS
   // ============================================================================

   corsWildcardWithCredentials(): void {
      this.warn(
         'CORS Warning: Using wildcard origin (*) with credentials is not allowed by browsers. ' +
         'Either specify explicit origins or disable credentials.'
      );
   }

   // ============================================================================
   // GUARD
   // ============================================================================

   guardExecuted(name: string, result: boolean): void {
      this.debug('Guard executed', { guard: name, authorized: result });
   }

   guardBlocked(name: string, reason?: string): void {
      this.warn('Guard blocked request', { guard: name, reason });
   }

   guardError(name: string, error: any): void {
      this.error('Guard error', error, { guard: name });
   }

   // ============================================================================
   // I18N
   // ============================================================================

   languageDetected(language: string, source: string): void {
      this.debug('Language detected', { language, source });
   }

   languageChanged(from: string, to: string): void {
      this.info('Language changed', { from, to });
   }

   translationMissing(key: string, language: string): void {
      this.warn('Translation missing', { key, language });
   }

   // ============================================================================
   // VALIDATION
   // ============================================================================

   validationFailed(field: string, reason: string): void {
      this.warn('Validation failed', { field, reason });
   }

   validationError(error: any): void {
      this.error('Validation error', error);
   }

   // ============================================================================
   // CACHE
   // ============================================================================

   cacheHit(key: string): void {
      this.debug('Cache hit', { key });
   }

   cacheMiss(key: string): void {
      this.debug('Cache miss', { key });
   }

   cacheCleared(pattern?: string): void {
      this.info('Cache cleared', { pattern: pattern || 'all' });
   }
}

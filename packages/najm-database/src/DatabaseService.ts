import { isRepository, DI, Service, Container, Inject, Meta, getPropertyInjections, getDatabase } from 'najm-core';
import { Err, LoggerService, Scan, ScannerService, ScanType } from 'najm-core';
import type { Database, DatabaseInjection, DatabaseConfig } from './types';
import { DATABASE_CONFIG, TRANSACTIONS } from './tokens';

@Service()
@Meta({ layer: 'plugin', order: 0 })
export class DatabaseService {
   @DI() private container!: Container;
   @Scan() private scanner!: ScannerService;
   @Inject(DATABASE_CONFIG) private config!: DatabaseConfig;
   @Inject(LoggerService) private log!: LoggerService;

   private injections: DatabaseInjection[] = [];
   private databasesReady = false;
   private injectorRegistered = false;

   async onInit(): Promise<void> {
      await this.setupDatabases();
      this.registerInjector();
   }

   // ============================================================================
   // LIFECYCLE: SCAN
   // ============================================================================

   async scan(): Promise<void> {
      this.scanner.scan(ScanType.APP, {
         onClass: (provider) => {
            // Scan @Repository() decorated classes
            if (isRepository(provider)) {
               const dbName = getDatabase(provider);

               this.injections.push({
                  type: 'database',
                  target: provider,
                  propertyKey: 'db',
                  databaseName: dbName,
               });

               this.container.setInjection({
                  type: 'database',
                  target: provider,
                  propertyKey: 'db',
                  databaseName: dbName,
               });
            }

            // Scan @DB() property decorators
            const propInjections = getPropertyInjections(provider);
            const dbInjections = propInjections.filter(
               inj =>
                  inj.token === 'Database' ||
                  (typeof inj.token === 'string' && inj.token.startsWith('Database:'))
            );

            for (const injection of dbInjections) {
               const dbName =
                  injection.databaseName ??
                  (typeof injection.token === 'string'
                     ? injection.token.replace('Database:', '')
                     : 'default');

               this.injections.push({
                  type: 'database',
                  target: provider,
                  propertyKey: injection.propertyKey,
                  databaseName: dbName,
               });

               this.container.setInjection({
                  type: 'database',
                  target: provider,
                  propertyKey: injection.propertyKey,
                  databaseName: dbName,
               });
            }
         }
      });
   }

   // ============================================================================
   // LIFECYCLE: CONFIGURE
   // ============================================================================

   async configure(): Promise<void> {
      await this.setupDatabases();
      this.registerInjector();
   }

   private async setupDatabases(): Promise<void> {
      if (this.databasesReady) {
         return;
      }

      if (!this.config) {
         this.databasesReady = true;
         return;
      }

      if (this.isSingleDatabase(this.config)) {
         await this.register('default', this.config);
         this.databasesReady = true;
         return;
      }

      if (Object.keys(this.config).length === 0) {
         this.databasesReady = true;
         return;
      }

      await Promise.all(
         Object.entries(this.config).map(([name, instance]) => this.register(name, instance))
      );
      this.databasesReady = true;
   }

   private registerInjector(): void {
      if (this.injectorRegistered) {
         return;
      }

      this.container.use({
         name: 'Database',
         global: true,
         inject: (instance, ctor, registry, injections) => {
            // Handle @Repository() decorated classes
            if (isRepository(ctor)) {
               const dbName = getDatabase(ctor);
               const dbToken = `Database:${dbName}`;
               if (registry?.has(dbToken)) {
                  const rawDb = registry.get(dbToken);
                  this.defineTransactionalProperty(instance, 'db', rawDb, dbName);
               } else {
                  this.log.databaseNotFound(dbName);
               }
            }

            // Handle @DB() property decorators
            const props = injections ?? [];
            for (const injection of props) {
               const token = injection.token;
               const isDatabaseToken =
                  token === 'Database' ||
                  (typeof token === 'string' && token.startsWith('Database:'));

               if (!isDatabaseToken) {
                  continue;
               }

               const dbName =
                  injection.databaseName ??
                  (typeof token === 'string' ? token.replace('Database:', '') : 'default');
               const dbToken = `Database:${dbName}`;

               if (registry?.has(dbToken)) {
                  const rawDb = registry.get(dbToken);
                  this.defineTransactionalProperty(instance, injection.propertyKey, rawDb, dbName);
               } else {
                  this.log.databaseNotFound(dbName);
               }
            }
         }
      });

      this.injectorRegistered = true;
   }

   private defineTransactionalProperty(
      instance: any,
      propertyKey: string | symbol,
      rawDb: any,
      databaseName: string
   ): void {
      const container = this.container;

      Object.defineProperty(instance, propertyKey, {
         get() {
            const transactions = container.get(TRANSACTIONS);
            const activeTrx = transactions?.get(databaseName);
            return activeTrx ?? rawDb;
         },
         enumerable: true,
         configurable: true,
      });
   }

   // ============================================================================
   // LIFECYCLE: ACTIVATE & READY
   // ============================================================================

   async activate(): Promise<void> {
      this.validateInjections();
   }

   private validateInjections(): void {
      const missing: string[] = [];

      for (const injection of this.injections) {
         if (!this.has(injection.databaseName)) {
            missing.push(injection.databaseName);
         }
      }

      if (missing.length > 0) {
         const uniqueMissing = [...new Set(missing)];
         throw Err.notFound(uniqueMissing.join(', '));
      }
   }

   async onReady(): Promise<void> {
      const count = this.container.getInjections('database').length;
      this.log.info(`Database plugin ready: ${count} injection(s)`);
   }

   // ============================================================================
   // DATABASE REGISTRATION
   // ============================================================================

   public async register(name: string, instance: any): Promise<void> {
      this.validateName(name);

      if (typeof instance.connect === 'function') {
         try {
            await instance.connect();
            this.log.databaseConnected(name);
         } catch (error: any) {
            throw Err.connectionFailed(name);
         }
      }

      this.container.set(`Database:${name}`, instance);
   }

   // ============================================================================
   // PUBLIC API
   // ============================================================================

   public get<T extends Database = Database>(name: string = 'default'): T | any {
      const token = `Database:${name}`;

      if (!this.container.has(token)) {
         throw Err.notFound(name);
      }

      return this.container.get<T>(token);
   }

   public has(name: string): boolean {
      return this.container.has(`Database:${name}`);
   }

   public getNames(): string[] {
      return [...this.container.registry.keys()]
         .filter(
            (token): token is string =>
               typeof token === 'string' && token.startsWith('Database:')
         )
         .map(token => token.replace('Database:', ''))
         .sort();
   }

   public getAll(): Record<string, Database> {
      const databases: Record<string, Database> = {};

      for (const name of this.getNames()) {
         databases[name] = this.get(name);
      }

      return databases;
   }

   public isEmpty(): boolean {
      return this.getNames().length === 0;
   }

   public getActiveTransaction(database: string = 'default') {
      const transactions = this.container.get(TRANSACTIONS);
      return transactions?.get(database) ?? null;
   }

   public getInjections(): ReadonlyArray<DatabaseInjection> {
      return this.injections;
   }

   // ============================================================================
   // CLEANUP
   // ============================================================================

   public async clear(): Promise<void> {
      const names = this.getNames();

      await Promise.allSettled(
         names.map(async (name) => {
            try {
               const db = this.get(name);
               if (typeof db.disconnect === 'function') {
                  await db.disconnect();
                  this.log.databaseDisconnected(name);
               }
            } catch (error) {
               this.log.databaseDisconnectFailed(name, error);
            }
         })
      );

      await Promise.all(
         names.map(name => this.container.delete(`Database:${name}`))
      );
   }

   // ============================================================================
   // UTILITIES
   // ============================================================================

   private isSingleDatabase(value: any): boolean {
      if (typeof value !== 'object' || value === null) {
         return false;
      }

      const dbIndicators = [
         'query',
         'execute',
         'transaction',
         'connect',
         '$client',
         'prepare',
         'raw',
         'pool',
         'driver',
      ];

      const hasDbFeature = dbIndicators.some(
         (prop) =>
            typeof value[prop] === 'function' ||
            (prop in value && value[prop] !== undefined)
      );

      if (hasDbFeature) {
         return true;
      }

      const keys = Object.keys(value);
      if (keys.length === 0) {
         return false;
      }

      const values = Object.values(value);

      if (values.length === 0) {
         return false;
      }

      const allValuesAreObjects = values.every(
         (v) => typeof v === 'object' && v !== null
      );
      return !allValuesAreObjects;
   }

   private validateName(name: string): void {
      if (!name || typeof name !== 'string') {
         Err.dbInvalidName(name, 'must be a non-empty string');
      }
   }
}

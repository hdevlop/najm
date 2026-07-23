import { Err, Scan, ScannerService, ScanType } from 'najm-core';
import { LoggerService } from 'najm-core';
import { Container, DI, Inject, Meta, Service } from 'najm-core';
import { DatabaseService } from './DatabaseService';
import type { TransactionalOptions, TransactionInjection } from './types';
import { TRANSACTION_DEPTH, TRANSACTIONS } from './tokens';
import { getTransactionalMethods } from './decorator';

const TRANSACTION_WRAPPER = Symbol('najm:transaction-wrapper');

type WrappedTransactionMethod = Function & {
   [TRANSACTION_WRAPPER]?: {
      target: Function;
      database: string;
   };
};

@Service()
@Meta({ layer: 'plugin' })
export class TransactionService {
   @DI() private container!: Container;
   @Scan() private scanner!: ScannerService;
   @Inject(DatabaseService) private databaseService!: DatabaseService;
   @Inject(LoggerService) private log!: LoggerService;

   // ============================================================================
   // LIFECYCLE: SCAN
   // ============================================================================

   async scan(): Promise<void> {
      this.scanner.scan(ScanType.APP, {
         onClass: (provider) => {
            const methods = getTransactionalMethods(provider);

            for (const { propertyKey, options } of methods) {
               this.container.setInjection({
                  type: 'transaction',
                  target: provider,
                  propertyKey,
                  options,
               });
            }
         }
      });
   }

   // ============================================================================
   // LIFECYCLE: CONFIGURE
   // ============================================================================

   async configure(): Promise<void> {
      this.registerInjector();
   }

   private registerInjector(): void {
      this.container.use({
         name: 'Transaction',
         global: true,
         inject: (instance, ctor) => {
            const injections = this.container.getInjectionsFor<TransactionInjection>('transaction', ctor);

            for (const { target, propertyKey, options } of injections) {
               if (target !== ctor) {
                  this.invalidTransactionConfig(
                     target,
                     ctor,
                     propertyKey,
                     options,
                     'Injection target does not match the constructor being wrapped',
                  );
               }

               this.wrapMethod(instance, ctor, target, propertyKey, options);
            }
         }
      });
   }

   private wrapMethod(
      instance: any,
      actualTarget: Function,
      expectedTarget: Function,
      propertyKey: string | symbol,
      options: TransactionalOptions
   ): void {
      const original = instance[propertyKey] as WrappedTransactionMethod;

      if (typeof original !== 'function') {
         this.invalidTransactionConfig(
            expectedTarget,
            actualTarget,
            propertyKey,
            options,
            'Decorated transaction property is not a method',
         );
      }

      if (original[TRANSACTION_WRAPPER]) {
         this.invalidTransactionConfig(
            expectedTarget,
            actualTarget,
            propertyKey,
            options,
            'Duplicate transaction wrapper detected',
         );
      }

      const service = this;
      const wrapped = async function (this: unknown, ...args: any[]) {
         return service.executeMethod(instance, original, args, options);
      } as WrappedTransactionMethod;

      Object.defineProperty(wrapped, TRANSACTION_WRAPPER, {
         value: {
            target: expectedTarget,
            database: options.database ?? 'default',
         },
      });

      instance[propertyKey] = wrapped;
   }

   // ============================================================================
   // LIFECYCLE: ACTIVATE & READY
   // ============================================================================

   async activate(): Promise<void> {
      this.validateInjections();
   }

   private validateInjections(): void {
      const injections = this.container.getInjections<TransactionInjection>('transaction');
      const seen = new Map<Function, Set<string | symbol>>();

      for (const { target, propertyKey, options } of injections) {
         const methods = seen.get(target) ?? new Set<string | symbol>();
         if (methods.has(propertyKey)) {
            this.invalidTransactionConfig(
               target,
               target,
               propertyKey,
               options,
               'Duplicate transaction injection detected',
            );
         }
         methods.add(propertyKey);
         seen.set(target, methods);

         if (typeof target?.prototype?.[propertyKey] !== 'function') {
            this.invalidTransactionConfig(
               target,
               target,
               propertyKey,
               options,
               'Decorated transaction property is not a method',
            );
         }

         const dbName = options?.database ?? 'default';
         if (!this.databaseService.has(dbName)) {
            throw Err.notFound(`Database '${dbName}' for @Transaction`);
         }
      }
   }

   private invalidTransactionConfig(
      expectedTarget: Function | undefined,
      actualTarget: Function | undefined,
      propertyKey: string | symbol,
      options: TransactionalOptions,
      reason: string,
   ): never {
      const expected = expectedTarget?.name || '<unknown>';
      const actual = actualTarget?.name || '<unknown>';
      const database = options?.database ?? 'default';

      return Err.invalidConfig(
         '@Transaction',
         `${reason}; expectedConstructor=${expected}; actualConstructor=${actual}; method=${String(propertyKey)}; database=${database}`,
      );
   }

   async onReady(): Promise<void> {
      const count = this.container.getInjections('transaction').length;
      this.log.debug(`Transaction plugin ready: ${count} transactional method(s)`);
   }

   // ============================================================================
   // PUBLIC API
   // ============================================================================

   public getActive(database: string = 'default'): any | null {
      const transactions = this.container.get(TRANSACTIONS);
      return transactions?.get(database) ?? null;
   }

   public isActive(database: string = 'default'): boolean {
      return this.getActive(database) !== null;
   }

   public getAllActive(): Map<string, any> {
      return this.container.get(TRANSACTIONS) ?? new Map();
   }

   public getDepth(): number {
      return this.container.get(TRANSACTION_DEPTH) ?? 0;
   }

   // ============================================================================
   // RUN TRANSACTION
   // ============================================================================

   public async run<T>(
      fn: (trx: any) => Promise<T>,
      options: TransactionalOptions = {}
   ): Promise<T> {
      const dbName = options.database ?? 'default';

      const existing = this.getActive(dbName);
      if (existing) {
         const prevDepth = this.getDepth();
         this.container.set(TRANSACTION_DEPTH, prevDepth + 1);
         try {
            return await fn(existing);
         } finally {
            this.container.set(TRANSACTION_DEPTH, prevDepth);
         }
      }

      const db = this.databaseService.get(dbName);
      return this.executeWithRetries(db, dbName, fn, options);
   }

   // ============================================================================
   // EXECUTE METHOD (for @Transaction decorator)
   // ============================================================================

   public async executeMethod<T>(
      instance: any,
      method: Function,
      args: any[],
      options: TransactionalOptions = {}
   ): Promise<T> {
      return this.run(async () => {
         return await method.apply(instance, args);
      }, options);
   }

   // ============================================================================
   // INTERNAL
   // ============================================================================

   private async executeWithRetries<T>(
      db: any,
      dbName: string,
      fn: (trx: any) => Promise<T>,
      options: TransactionalOptions
   ): Promise<T> {
      const maxAttempts = (options.retries ?? 0) + 1;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
         try {
            return await this.executeTransaction(db, dbName, fn, options);
         } catch (error) {
            lastError = error as Error;

            if (attempt < maxAttempts && this.isRetriable(lastError)) {
               const delay = this.calculateBackoff(attempt);
               this.log.transactionRetry(dbName, attempt, maxAttempts, lastError.message);
               await this.sleep(delay);
               continue;
            }

            this.log.transactionFailed(dbName, lastError);
            throw lastError;
         }
      }

      throw lastError!;
   }

   private async executeTransaction<T>(
      db: any,
      dbName: string,
      fn: (trx: any) => Promise<T>,
      options: TransactionalOptions
   ): Promise<T> {
      const prevTransactions = this.getAllActive();
      const prevDepth = this.getDepth();

      const transactionFn = async (trx: any) => {
         const transactions = new Map(prevTransactions);
         transactions.set(dbName, trx);

         return this.container.run(
            {
               transactions,
               transactionDepth: prevDepth + 1,
            },
            async () => await fn(trx)
         );
      };

      if (this.isBetterSqliteDriver(db)) {
         return this.executeAsyncSqliteTransaction(db, dbName, fn, prevTransactions, prevDepth);
      }

      const transactionOptions = this.buildOptions(options);

      if (typeof db.transaction === 'function') {
         return transactionOptions
            ? db.transaction(transactionFn, transactionOptions)
            : db.transaction(transactionFn);
      }

      if (typeof db.$transaction === 'function') {
         return transactionOptions
            ? db.$transaction(transactionFn, transactionOptions)
            : db.$transaction(transactionFn);
      }

      throw Err.invalidConfig('database', 'Database does not support transactions');
   }

   private async executeAsyncSqliteTransaction<T>(
      db: any,
      dbName: string,
      fn: (trx: any) => Promise<T>,
      prevTransactions: Map<string, any>,
      prevDepth: number
   ): Promise<T> {
      const client = this.getSqliteClient(db);

      if (!client || typeof client.exec !== 'function') {
         throw Err.invalidConfig('database', 'SQLite client does not support exec()');
      }

      client.exec('BEGIN');

      try {
         const transactions = new Map(prevTransactions);
         transactions.set(dbName, db);

         const result = await this.container.run(
            {
               transactions,
               transactionDepth: prevDepth + 1,
            },
            async () => await fn(db)
         );

         client.exec('COMMIT');
         return result;
      } catch (error) {
         try {
            client.exec('ROLLBACK');
         } catch {
            // Ignore rollback errors and rethrow original failure
         }
         throw error;
      }
   }

   private isBetterSqliteDriver(db: any): boolean {
      const client = this.getSqliteClient(db);
      return !!client && typeof client.exec === 'function' && typeof client.pragma === 'function';
   }

   private getSqliteClient(db: any): any {
      return db?.$client ?? db?.session?.client ?? null;
   }

   private buildOptions(options: TransactionalOptions): Record<string, any> | undefined {
      const opts: Record<string, any> = {};
      if (options.isolation) opts.isolationLevel = options.isolation;
      if (options.timeout) opts.timeout = options.timeout;
      return Object.keys(opts).length > 0 ? opts : undefined;
   }

   private isRetriable(error: any): boolean {
      const msg = error?.message?.toLowerCase() ?? '';
      const code = String(error?.code ?? '').toLowerCase();

      return (
         msg.includes('deadlock') ||
         msg.includes('lock timeout') ||
         msg.includes('serialization failure') ||
         msg.includes('could not serialize') ||
         msg.includes('database is locked') ||
         code === '40p01' ||
         code === '40001' ||
         code === '1213' ||
         code === '1205'
      );
   }

   private calculateBackoff(attempt: number): number {
      return Math.min(100 * Math.pow(2, attempt - 1), 2000) + Math.random() * 50;
   }

   private sleep(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms));
   }
}

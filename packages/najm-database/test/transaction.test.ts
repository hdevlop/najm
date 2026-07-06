import "reflect-metadata";
import { describe, test, expect, afterEach, beforeEach } from "bun:test";
import { Err, Server } from "najm-core";
import { Controller, Repository, reset, Service } from "najm-core";
import {  database, DB, Transaction, TransactionService, type DbClient } from "../src";
import { Body, Params, Post, Get } from "najm-core";

describe("Transaction Integration Tests", () => {
  let server: Server;
  let baseURL: string;

  beforeEach(async () => {
    await reset();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  // ==========================================
  // MOCK DATABASE IMPLEMENTATIONS
  // ==========================================

  class MockTransactionalDatabase {
    public connected = false;
    public queryLog: Array<{ sql: string; inTransaction: boolean }> = [];
    public transactionCount = 0;
    public commitCount = 0;
    public rollbackCount = 0;
    public currentTransaction: MockTransaction | null = null;

    async connect() {
      await new Promise(r => setTimeout(r, 5));
      this.connected = true;
    }

    async disconnect() {
      this.connected = false;
    }

    async query(sql: string, params?: any[]) {
      this.queryLog.push({
        sql,
        inTransaction: this.currentTransaction !== null
      });
      return { rows: [{ id: 1, data: "mock" }], sql, params };
    }

    async transaction<T>(fn: (trx: MockTransaction) => Promise<T>, options?: any): Promise<T> {
      this.transactionCount++;
      const trx = new MockTransaction(this, options);
      this.currentTransaction = trx;

      try {
        const result = await fn(trx);
        await trx.commit();
        this.commitCount++;
        return result;
      } catch (error) {
        await trx.rollback();
        this.rollbackCount++;
        throw error;
      } finally {
        this.currentTransaction = null;
      }
    }
  }

  class MockTransaction {
    public committed = false;
    public rolledBack = false;
    public queryLog: string[] = [];

    constructor(
      private parent: MockTransactionalDatabase,
      public options?: any
    ) { }

    async query(sql: string, params?: any[]) {
      this.queryLog.push(sql);
      return { rows: [{ id: 1, data: "transaction" }], sql, params };
    }

    async commit() {
      this.committed = true;
    }

    async rollback() {
      this.rolledBack = true;
    }
  }

  class DeadlockDatabase extends MockTransactionalDatabase {
    public attemptCount = 0;
    public failUntilAttempt = 2;

    async transaction<T>(fn: (trx: MockTransaction) => Promise<T>, options?: any): Promise<T> {
      this.attemptCount++;

      if (this.attemptCount < this.failUntilAttempt) {
        const error = new Error("Deadlock detected");
        (error as any).code = "40P01"; // PostgreSQL deadlock code
        throw error;
      }

      return super.transaction(fn, options);
    }
  }

  class SerializationFailureDatabase extends MockTransactionalDatabase {
    public attemptCount = 0;
    public failUntilAttempt = 3;

    async transaction<T>(fn: (trx: MockTransaction) => Promise<T>, options?: any): Promise<T> {
      this.attemptCount++;

      if (this.attemptCount < this.failUntilAttempt) {
        const error = new Error("could not serialize access");
        (error as any).code = "40001";
        throw error;
      }

      return super.transaction(fn, options);
    }
  }



  // ==========================================
  // BASIC TRANSACTION OPERATIONS
  // ==========================================

  describe("Basic Transaction Operations", () => {
    test("executes callback within transaction context", async () => {
      const db = new MockTransactionalDatabase();

      @Repository()
      class UserRepository {
        @DB() db: DbClient

        async createUser(name: string) {
          return this.db.query(`INSERT INTO users (name) VALUES ('${name}')`);
        }
      }

      @Controller('/users')
      class UserController {
        constructor(
          private userRepo: UserRepository,
          private transaction: TransactionService
        ) { }

        @Post('/')
        async createUser(@Body() body: { name: string }) {
          return this.transaction.run(async (trx) => {
            return this.userRepo.createUser(body.name);
          });
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(UserRepository, UserController)
        .listen(7001);
      baseURL = 'http://localhost:7001';

      const response = await fetch(`${baseURL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John' }),
      });

      expect(response.status).toBe(200);
      expect(db.transactionCount).toBe(1);
      expect(db.commitCount).toBe(1);
      expect(db.rollbackCount).toBe(0);
    });

    test("rolls back transaction on error", async () => {
      const db = new MockTransactionalDatabase();

      @Repository()
      class UserRepository {
        @DB() db: DbClient

        async createUser(name: string) {
          if (name === 'invalid') {
            Err("Invalid user name");
          }
          return this.db.query(`INSERT INTO users (name) VALUES ('${name}')`);
        }
      }

      @Controller('/users')
      class UserController {
        constructor(
          private userRepo: UserRepository,
          private transaction: TransactionService
        ) { }

        @Post('/')
        async createUser(@Body() body: { name: string }) {
          try {
            return await this.transaction.run(async () => {
              return this.userRepo.createUser(body.name);
            });
          } catch (error) {
            return { error: (error as Error).message };
          }
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(UserRepository, UserController)
        .listen(7002);
      baseURL = 'http://localhost:7002';

      const response = await fetch(`${baseURL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'invalid' }),
      });

      const data = await response.json();
      expect(data.error).toBe("Invalid user name");
      expect(db.transactionCount).toBe(1);
      expect(db.commitCount).toBe(0);
      expect(db.rollbackCount).toBe(1);
    });

    test("returns value from transaction callback", async () => {
      const db = new MockTransactionalDatabase();

      @Controller('/test')
      class TestController {
        constructor(private transaction: TransactionService) { }

        @Get('/value')
        async getValue() {
          const result = await this.transaction.run(async () => {
            return { computed: 42, source: 'transaction' };
          });
          return result;
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(TestController)
        .listen(7003);
      baseURL = 'http://localhost:7003';

      const response = await fetch(`${baseURL}/test/value`);
      const data = await response.json();

      expect(data.computed).toBe(42);
      expect(data.source).toBe('transaction');
    });
  });

  // ==========================================
  // @TRANSACTION DECORATOR TESTS
  // ==========================================

  describe("@Transaction Decorator", () => {
    test("wraps method in transaction automatically", async () => {
      const db = new MockTransactionalDatabase();

      @Repository()
      class OrderRepository {
        @DB() db: DbClient

        async createOrder(productId: string) {
          return this.db.query(`INSERT INTO orders (product_id) VALUES ('${productId}')`);
        }
      }

      @Service()
      class OrderService {
        constructor(private orderRepo: OrderRepository) { }

        @Transaction()
        async placeOrder(productId: string) {
          const order = await this.orderRepo.createOrder(productId);
          return { orderId: 1, productId, created: true };
        }
      }

      @Controller('/orders')
      class OrderController {
        constructor(private orderService: OrderService) { }

        @Post('/')
        async createOrder(@Body() body: { productId: string }) {
          return this.orderService.placeOrder(body.productId);
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(OrderRepository, OrderService, OrderController)
        .listen(7010);
      baseURL = 'http://localhost:7010';

      const response = await fetch(`${baseURL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 'prod-123' }),
      });

      const data = await response.json();
      expect(data.created).toBe(true);
      expect(db.transactionCount).toBe(1);
      expect(db.commitCount).toBe(1);
    });

    test("@Transaction with custom database", async () => {
      const primaryDb = new MockTransactionalDatabase();
      const analyticsDb = new MockTransactionalDatabase();

      @Repository('analytics')
      class AnalyticsRepository {
        @DB() db: DbClient

        async logEvent(event: string) {
          return this.db.query(`INSERT INTO events (name) VALUES ('${event}')`);
        }
      }

      @Service()
      class AnalyticsService {
        constructor(private analyticsRepo: AnalyticsRepository) { }

        @Transaction({ database: 'analytics' })
        async trackEvent(event: string) {
          await this.analyticsRepo.logEvent(event);
          return { tracked: true };
        }
      }

      @Controller('/analytics')
      class AnalyticsController {
        constructor(private analyticsService: AnalyticsService) { }

        @Post('/track')
        async track(@Body() body: { event: string }) {
          return this.analyticsService.trackEvent(body.event);
        }
      }

      server = await new Server({ isolated: true })
        .use(database({
          default: primaryDb,
          analytics: analyticsDb,
        }))
        .load(AnalyticsRepository, AnalyticsService, AnalyticsController)
        .listen(7011);
      baseURL = 'http://localhost:7011';

      await fetch(`${baseURL}/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'page_view' }),
      });

      expect(primaryDb.transactionCount).toBe(0);
      expect(analyticsDb.transactionCount).toBe(1);
    });

    test("@Transaction with isolation level", async () => {
      const db = new MockTransactionalDatabase();

      @Service()
      class IsolatedService {
        @Transaction({ isolation: 'serializable' })
        async criticalOperation() {
          return { executed: true };
        }
      }

      @Controller('/isolated')
      class IsolatedController {
        constructor(private service: IsolatedService) { }

        @Post('/execute')
        async execute() {
          return this.service.criticalOperation();
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(IsolatedService, IsolatedController)
        .listen(7012);
      baseURL = 'http://localhost:7012';

      await fetch(`${baseURL}/isolated/execute`, { method: 'POST' });

      expect(db.transactionCount).toBe(1);
      // The mock records options, we could verify isolation was passed
    });

    test("@Transaction rolls back on method error", async () => {
      const db = new MockTransactionalDatabase();

      @Service()
      class FailingService {
        @Transaction()
        async willFail() {
          Err("Business logic error");
        }
      }

      @Controller('/failing')
      class FailingController {
        constructor(private service: FailingService) { }

        @Post('/execute')
        async execute() {
          try {
            return await this.service.willFail();
          } catch (error) {
            return { error: (error as Error).message };
          }
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(FailingService, FailingController)
        .listen(7013);
      baseURL = 'http://localhost:7013';

      const response = await fetch(`${baseURL}/failing/execute`, { method: 'POST' });
      const data = await response.json();

      expect(data.error).toBe("Business logic error");
      expect(db.rollbackCount).toBe(1);
    });
  });

  // ==========================================
  // NESTED TRANSACTION TESTS
  // ==========================================

  describe("Nested Transactions", () => {
    test("reuses existing transaction in nested calls", async () => {
      const db = new MockTransactionalDatabase();

      @Service()
      class InnerService {
        constructor(private transaction: TransactionService) { }

        async innerOperation() {
          return this.transaction.run(async () => {
            return { inner: true };
          });
        }
      }

      @Service()
      class OuterService {
        constructor(
          private transaction: TransactionService,
          private innerService: InnerService
        ) { }

        async outerOperation() {
          return this.transaction.run(async () => {
            const innerResult = await this.innerService.innerOperation();
            return { outer: true, ...innerResult };
          });
        }
      }

      @Controller('/nested')
      class NestedController {
        constructor(private outerService: OuterService) { }

        @Post('/execute')
        async execute() {
          return this.outerService.outerOperation();
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(InnerService, OuterService, NestedController)
        .listen(7020);
      baseURL = 'http://localhost:7020';

      const response = await fetch(`${baseURL}/nested/execute`, { method: 'POST' });
      const data = await response.json();

      expect(data.outer).toBe(true);
      expect(data.inner).toBe(true);
      // Only ONE transaction should be created (reused for nested)
      expect(db.transactionCount).toBe(1);
    });

    test("tracks transaction depth correctly", async () => {
      const db = new MockTransactionalDatabase();
      const depths: number[] = [];

      @Service()
      class DepthTrackingService {
        constructor(private transaction: TransactionService) { }

        async level1() {
          return this.transaction.run(async () => {
            depths.push(this.transaction.getDepth());
            return this.level2();
          });
        }

        async level2() {
          return this.transaction.run(async () => {
            depths.push(this.transaction.getDepth());
            return this.level3();
          });
        }

        async level3() {
          return this.transaction.run(async () => {
            depths.push(this.transaction.getDepth());
            return { maxDepth: this.transaction.getDepth() };
          });
        }
      }

      @Controller('/depth')
      class DepthController {
        constructor(private service: DepthTrackingService) { }

        @Get('/test')
        async test() {
          const result = await this.service.level1();
          return { ...result, depths };
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(DepthTrackingService, DepthController)
        .listen(7021);
      baseURL = 'http://localhost:7021';

      const response = await fetch(`${baseURL}/depth/test`);
      const data = await response.json();

      expect(data.depths).toEqual([1, 2, 3]);
      expect(data.maxDepth).toBe(3);
    });

    test("nested @Transaction decorators share same transaction", async () => {
      const db = new MockTransactionalDatabase();

      @Service()
      class ServiceA {
        @Transaction()
        async operationA() {
          return { a: true };
        }
      }

      @Service()
      class ServiceB {
        constructor(private serviceA: ServiceA) { }

        @Transaction()
        async operationB() {
          const resultA = await this.serviceA.operationA();
          return { b: true, ...resultA };
        }
      }

      @Controller('/nested-decorators')
      class NestedDecoratorsController {
        constructor(private serviceB: ServiceB) { }

        @Post('/execute')
        async execute() {
          return this.serviceB.operationB();
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(ServiceA, ServiceB, NestedDecoratorsController)
        .listen(7022);
      baseURL = 'http://localhost:7022';

      const response = await fetch(`${baseURL}/nested-decorators/execute`, { method: 'POST' });
      const data = await response.json();

      expect(data.a).toBe(true);
      expect(data.b).toBe(true);
      expect(db.transactionCount).toBe(1); // Reused
    });
  });

  // ==========================================
  // RETRY LOGIC TESTS
  // ==========================================

  describe("Retry Logic", () => {
    test("retries on deadlock error", async () => {
      const db = new DeadlockDatabase();
      db.failUntilAttempt = 2;

      @Service()
      class RetryService {
        @Transaction({ retries: 3 })
        async operation() {
          return { success: true };
        }
      }

      @Controller('/retry')
      class RetryController {
        constructor(private service: RetryService) { }

        @Post('/deadlock')
        async deadlock() {
          return this.service.operation();
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(RetryService, RetryController)
        .listen(7030);
      baseURL = 'http://localhost:7030';

      const response = await fetch(`${baseURL}/retry/deadlock`, { method: 'POST' });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(db.attemptCount).toBe(2);
    });

    test("retries on serialization failure", async () => {
      const db = new SerializationFailureDatabase();
      db.failUntilAttempt = 3;

      @Service()
      class SerializableService {
        @Transaction({ retries: 5, isolation: 'serializable' })
        async criticalWrite() {
          return { written: true };
        }
      }

      @Controller('/serializable')
      class SerializableController {
        constructor(private service: SerializableService) { }

        @Post('/write')
        async write() {
          return this.service.criticalWrite();
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(SerializableService, SerializableController)
        .listen(7031);
      baseURL = 'http://localhost:7031';

      const response = await fetch(`${baseURL}/serializable/write`, { method: 'POST' });
      const data = await response.json();

      expect(data.written).toBe(true);
      expect(db.attemptCount).toBe(3);
    });



    test("does not retry non-retriable errors", async () => {
      const db = new MockTransactionalDatabase();
      let attemptCount = 0;

      @Service()
      class NonRetriableService {
        constructor(private transaction: TransactionService) { }

        async operation() {
          return this.transaction.run(async () => {
            attemptCount++;
            Err("Validation failed");
          }, { retries: 5 });
        }
      }

      @Controller('/non-retriable')
      class NonRetriableController {
        constructor(private service: NonRetriableService) { }

        @Post('/execute')
        async execute() {
          try {
            return await this.service.operation();
          } catch (error) {
            return { error: (error as Error).message, attempts: attemptCount };
          }
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(NonRetriableService, NonRetriableController)
        .listen(7033);
      baseURL = 'http://localhost:7033';

      const response = await fetch(`${baseURL}/non-retriable/execute`, { method: 'POST' });
      const data = await response.json();

      expect(data.error).toBe("Validation failed");
      expect(data.attempts).toBe(1); // No retries for validation errors
    });
  });

  // ==========================================
  // TRANSACTION-AWARE REPOSITORY TESTS
  // ==========================================

  describe("Transaction-Aware Repositories", () => {
    test("repository automatically uses active transaction", async () => {
      const db = new MockTransactionalDatabase();
      const querySources: string[] = [];

      // Override query to track source
      const originalQuery = db.query.bind(db);
      db.query = async (sql: string, params?: any[]) => {
        querySources.push('raw');
        return originalQuery(sql, params);
      };

      @Repository()
      class ProductRepository {
        @DB() db: DbClient

        async findAll() {
          return this.db.query('SELECT * FROM products');
        }

        async create(name: string) {
          return this.db.query(`INSERT INTO products (name) VALUES ('${name}')`);
        }
      }

      @Controller('/products')
      class ProductController {
        constructor(
          private productRepo: ProductRepository,
          private transaction: TransactionService
        ) { }

        @Post('/batch')
        async batchCreate(@Body() body: { names: string[] }) {
          return this.transaction.run(async () => {
            const results = [];
            for (const name of body.names) {
              results.push(await this.productRepo.create(name));
            }
            return { created: results.length };
          });
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(ProductRepository, ProductController)
        .listen(7040);
      baseURL = 'http://localhost:7040';

      await fetch(`${baseURL}/products/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: ['Product A', 'Product B', 'Product C'] }),
      });

      expect(db.transactionCount).toBe(1);
      expect(db.commitCount).toBe(1);
    });

    test("repository uses raw connection outside transaction", async () => {
      const db = new MockTransactionalDatabase();

      @Repository()
      class SimpleRepository {
        public db: DbClient

        async findById(id: number) {
          return this.db.query(`SELECT * FROM items WHERE id = ${id}`);
        }
      }

      @Controller('/simple')
      class SimpleController {
        constructor(private repo: SimpleRepository) { }

        @Get('/:id')
        async getById(@Params('id') id: string) {
          return this.repo.findById(parseInt(id));
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(SimpleRepository, SimpleController)
        .listen(7041);
      baseURL = 'http://localhost:7041';

      await fetch(`${baseURL}/simple/1`);

      // No transaction started for simple read
      expect(db.transactionCount).toBe(0);
      expect(db.queryLog.length).toBe(1);
    });
  });

  // ==========================================
  // MULTI-DATABASE TRANSACTIONS
  // ==========================================

  describe("Multi-Database Transactions", () => {
    test("handles transactions on different databases independently", async () => {
      const primaryDb = new MockTransactionalDatabase();
      const secondaryDb = new MockTransactionalDatabase();

      @Repository('primary')
      class PrimaryRepository {
        public db: DbClient
        async write(data: string) {
          return this.db.query(`INSERT INTO primary_table VALUES ('${data}')`);
        }
      }

      @Repository('secondary')
      class SecondaryRepository {
        public db: DbClient
        async write(data: string) {
          return this.db.query(`INSERT INTO secondary_table VALUES ('${data}')`);
        }
      }

      @Controller('/multi')
      class MultiDbController {
        constructor(
          private primary: PrimaryRepository,
          private secondary: SecondaryRepository,
          private transaction: TransactionService
        ) { }

        @Post('/write-both')
        async writeBoth(@Body() body: { data: string }) {
          // Transaction on primary
          await this.transaction.run(async () => {
            await this.primary.write(body.data);
          }, { database: 'primary' });

          // Separate transaction on secondary
          await this.transaction.run(async () => {
            await this.secondary.write(body.data);
          }, { database: 'secondary' });

          return { written: true };
        }
      }

      server = await new Server({ isolated: true })
        .use(database({
          primary: primaryDb,
          secondary: secondaryDb,
        }))
        .load(PrimaryRepository, SecondaryRepository, MultiDbController)
        .listen(7050);
      baseURL = 'http://localhost:7050';

      await fetch(`${baseURL}/multi/write-both`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' }),
      });

      expect(primaryDb.transactionCount).toBe(1);
      expect(secondaryDb.transactionCount).toBe(1);
    });

    test("getAllActive returns all active transactions", async () => {
      const db = new MockTransactionalDatabase();
      let activeCount = 0;

      @Controller('/active')
      class ActiveController {
        constructor(private transaction: TransactionService) { }

        @Post('/check')
        async check() {
          return this.transaction.run(async () => {
            activeCount = this.transaction.getAllActive().size;
            return { active: activeCount };
          });
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(ActiveController)
        .listen(7051);
      baseURL = 'http://localhost:7051';

      const response = await fetch(`${baseURL}/active/check`, { method: 'POST' });
      const json = await response.json();
      const data = json.data ?? json;

      expect(data.active).toBe(1);
    });
  });

  // ==========================================
  // TRANSACTION STATE DETECTION
  // ==========================================

  describe("Transaction State Detection", () => {
    test("isActive returns correct state", async () => {
      const db = new MockTransactionalDatabase();
      const states: boolean[] = [];

      @Controller('/state')
      class StateController {
        constructor(private transaction: TransactionService) { }

        @Get('/check')
        async check() {
          states.push(this.transaction.isActive());

          await this.transaction.run(async () => {
            states.push(this.transaction.isActive());
          });

          states.push(this.transaction.isActive());
          return { states };
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(StateController)
        .listen(7060);
      baseURL = 'http://localhost:7060';

      const response = await fetch(`${baseURL}/state/check`);
      const data = await response.json();

      expect(data.states).toEqual([false, true, false]);
    });

    test("getActive returns transaction object when active", async () => {
      const db = new MockTransactionalDatabase();
      let trxWasActive = false;

      @Controller('/active-trx')
      class ActiveTrxController {
        constructor(private transaction: TransactionService) { }

        @Post('/check')
        async check() {
          return this.transaction.run(async (trx) => {
            const active = this.transaction.getActive();
            trxWasActive = active === trx;
            return { same: trxWasActive };
          });
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(ActiveTrxController)
        .listen(7061);
      baseURL = 'http://localhost:7061';

      const response = await fetch(`${baseURL}/active-trx/check`, { method: 'POST' });
      const data = await response.json();

      expect(data.same).toBe(true);
    });
  });

  // ==========================================
  // REAL-WORLD: BANK TRANSFER
  // ==========================================

  describe("Real-World: Bank Transfer", () => {
    test("atomic money transfer between accounts", async () => {
      const db = new MockTransactionalDatabase();
      const accountBalances = new Map([
        [1, 1000],
        [2, 500],
      ]);

      @Repository()
      class AccountRepository {
        @DB() db: DbClient

        async getBalance(accountId: number) {
          return accountBalances.get(accountId) ?? 0;
        }

        async updateBalance(accountId: number, newBalance: number) {
          accountBalances.set(accountId, newBalance);
          return this.db.query(
            `UPDATE accounts SET balance = ${newBalance} WHERE id = ${accountId}`
          );
        }
      }

      @Service()
      class TransferService {
        constructor(
          private accountRepo: AccountRepository,
          private transaction: TransactionService
        ) { }

        async transfer(fromId: number, toId: number, amount: number) {
          return this.transaction.run(async () => {
            const fromBalance = await this.accountRepo.getBalance(fromId);
            const toBalance = await this.accountRepo.getBalance(toId);

            if (fromBalance < amount) {
              Err("Insufficient funds");
            }

            await this.accountRepo.updateBalance(fromId, fromBalance - amount);
            await this.accountRepo.updateBalance(toId, toBalance + amount);

            return {
              from: { id: fromId, balance: fromBalance - amount },
              to: { id: toId, balance: toBalance + amount },
            };
          });
        }
      }

      @Controller('/transfer')
      class TransferController {
        constructor(private transferService: TransferService) { }

        @Post('/')
        async transfer(@Body() body: { from: number; to: number; amount: number }) {
          return this.transferService.transfer(body.from, body.to, body.amount);
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(AccountRepository, TransferService, TransferController)
        .listen(7070);
      baseURL = 'http://localhost:7070';

      const response = await fetch(`${baseURL}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 1, to: 2, amount: 200 }),
      });

      const data = await response.json();
      expect(data.from.balance).toBe(800);
      expect(data.to.balance).toBe(700);
      expect(db.commitCount).toBe(1);
    });

    test("rolls back transfer on insufficient funds", async () => {
      const db = new MockTransactionalDatabase();
      const accountBalances = new Map([
        [1, 100],
        [2, 500],
      ]);

      @Repository()
      class AccountRepository {
        @DB() db: DbClient

        async getBalance(accountId: number) {
          return accountBalances.get(accountId) ?? 0;
        }

        async updateBalance(accountId: number, newBalance: number) {
          accountBalances.set(accountId, newBalance);
          return this.db.query(`UPDATE accounts SET balance = ${newBalance}`);
        }
      }

      @Service()
      class TransferService {
        constructor(private accountRepo: AccountRepository) { }

        @Transaction()
        async transfer(fromId: number, toId: number, amount: number) {
          const fromBalance = await this.accountRepo.getBalance(fromId);
          if (fromBalance < amount) {
            Err("Insufficient funds");
          }

          const toBalance = await this.accountRepo.getBalance(toId);
          await this.accountRepo.updateBalance(fromId, fromBalance - amount);
          await this.accountRepo.updateBalance(toId, toBalance + amount);

          return { success: true };
        }
      }

      @Controller('/transfer')
      class TransferController {
        constructor(private transferService: TransferService) { }

        @Post('/')
        async transfer(@Body() body: { from: number; to: number; amount: number }) {
          try {
            return await this.transferService.transfer(body.from, body.to, body.amount);
          } catch (error) {
            return { error: (error as Error).message };
          }
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(AccountRepository, TransferService, TransferController)
        .listen(7071);
      baseURL = 'http://localhost:7071';

      const response = await fetch(`${baseURL}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 1, to: 2, amount: 500 }),
      });

      const data = await response.json();
      expect(data.error).toBe("Insufficient funds");
      expect(db.rollbackCount).toBe(1);

      // Balances should remain unchanged
      expect(accountBalances.get(1)).toBe(100);
      expect(accountBalances.get(2)).toBe(500);
    });
  });

  // ==========================================
  // REAL-WORLD: ORDER PROCESSING
  // ==========================================

  describe("Real-World: Order Processing", () => {
    test("creates order with inventory reservation atomically", async () => {
      const db = new MockTransactionalDatabase();
      const inventory = new Map([['PROD-001', 10]]);
      const orders: any[] = [];

      @Repository()
      class InventoryRepository {
        @DB() db: DbClient

        async getStock(productId: string) {
          return inventory.get(productId) ?? 0;
        }

        async reserve(productId: string, quantity: number) {
          const current = inventory.get(productId) ?? 0;
          if (current < quantity) {
            Err(`Insufficient stock for ${productId}`);
          }
          inventory.set(productId, current - quantity);
          return this.db.query(`UPDATE inventory SET quantity = quantity - ${quantity}`);
        }
      }

      @Repository()
      class OrderRepository {
        @DB() db: DbClient

        async create(order: any) {
          orders.push(order);
          return this.db.query(`INSERT INTO orders VALUES (...)`);
        }
      }

      @Service()
      class OrderService {
        constructor(
          private inventoryRepo: InventoryRepository,
          private orderRepo: OrderRepository
        ) { }

        @Transaction()
        async placeOrder(productId: string, quantity: number, customerId: string) {
          // Check and reserve inventory
          await this.inventoryRepo.reserve(productId, quantity);

          // Create order
          const order = {
            id: `ORD-${Date.now()}`,
            productId,
            quantity,
            customerId,
            status: 'confirmed',
          };
          await this.orderRepo.create(order);

          return order;
        }
      }

      @Controller('/orders')
      class OrderController {
        constructor(private orderService: OrderService) { }

        @Post('/')
        async create(@Body() body: { productId: string; quantity: number; customerId: string }) {
          return this.orderService.placeOrder(body.productId, body.quantity, body.customerId);
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(InventoryRepository, OrderRepository, OrderService, OrderController)
        .listen(7080);
      baseURL = 'http://localhost:7080';

      const response = await fetch(`${baseURL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'PROD-001',
          quantity: 3,
          customerId: 'CUST-123',
        }),
      });

      const data = await response.json();
      expect(data.status).toBe('confirmed');
      expect(data.quantity).toBe(3);
      expect(inventory.get('PROD-001')).toBe(7);
      expect(orders.length).toBe(1);
      expect(db.commitCount).toBe(1);
    });

    test("rolls back order when inventory insufficient", async () => {
      const db = new MockTransactionalDatabase();
      const inventory = new Map([['PROD-001', 2]]);
      const orders: any[] = [];

      @Repository()
      class InventoryRepository {
        @DB() db: DbClient

        async reserve(productId: string, quantity: number) {
          const current = inventory.get(productId) ?? 0;
          if (current < quantity) {
            Err(`Insufficient stock`);
          }
          inventory.set(productId, current - quantity);
        }
      }

      @Repository()
      class OrderRepository {
        @DB() db: DbClient

        async create(order: any) {
          orders.push(order);
        }
      }

      @Service()
      class OrderService {
        constructor(
          private inventoryRepo: InventoryRepository,
          private orderRepo: OrderRepository
        ) { }

        @Transaction()
        async placeOrder(productId: string, quantity: number) {
          await this.inventoryRepo.reserve(productId, quantity);
          await this.orderRepo.create({ productId, quantity });
          return { success: true };
        }
      }

      @Controller('/orders')
      class OrderController {
        constructor(private orderService: OrderService) { }

        @Post('/')
        async create(@Body() body: { productId: string; quantity: number }) {
          try {
            return await this.orderService.placeOrder(body.productId, body.quantity);
          } catch (error) {
            return { error: (error as Error).message };
          }
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(InventoryRepository, OrderRepository, OrderService, OrderController)
        .listen(7081);
      baseURL = 'http://localhost:7081';

      const response = await fetch(`${baseURL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 'PROD-001', quantity: 10 }),
      });

      const data = await response.json();
      expect(data.error).toBe('Insufficient stock');
      expect(inventory.get('PROD-001')).toBe(2); // Unchanged
      expect(orders.length).toBe(0); // No order created
      expect(db.rollbackCount).toBe(1);
    });
  });

  // ==========================================
  // EDGE CASES
  // ==========================================

  describe("Edge Cases", () => {
    test("handles empty transaction callback", async () => {
      const db = new MockTransactionalDatabase();

      @Controller('/empty')
      class EmptyController {
        constructor(private transaction: TransactionService) { }

        @Post('/execute')
        async execute() {
          const result = await this.transaction.run(async () => {
            // Empty callback
          });
          return { result: result ?? 'undefined' };
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(EmptyController)
        .listen(7090);
      baseURL = 'http://localhost:7090';

      const response = await fetch(`${baseURL}/empty/execute`, { method: 'POST' });
      const data = await response.json();

      expect(data.result).toBe('undefined');
      expect(db.commitCount).toBe(1);
    });

    test("handles async callback that returns primitive", async () => {
      const db = new MockTransactionalDatabase();

      @Controller('/primitive')
      class PrimitiveController {
        constructor(private transaction: TransactionService) { }

        @Post('/number')
        async getNumber() {
          return this.transaction.run(async () => 42);
        }

        @Post('/boolean')
        async getBoolean() {
          return this.transaction.run(async () => true);
        }

        @Post('/object')
        async getObject() {
          return this.transaction.run(async () => ({ value: "hello" }));
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(PrimitiveController)
        .listen(7091);
      baseURL = 'http://localhost:7091';

      const numResponse = await fetch(`${baseURL}/primitive/number`, { method: 'POST' });
      const numJson = await numResponse.json();
      expect(numJson.data ?? numJson).toBe(42);

      const boolResponse = await fetch(`${baseURL}/primitive/boolean`, { method: 'POST' });
      const boolJson = await boolResponse.json();
      expect(boolJson.data ?? boolJson).toBe(true);

      const objResponse = await fetch(`${baseURL}/primitive/object`, { method: 'POST' });
      const objJson = await objResponse.json();
      const objData = objJson.data ?? objJson;
      expect(objData.value).toBe("hello");
    });

    test("transaction timeout option is passed to database", async () => {
      const db = new MockTransactionalDatabase();
      let receivedOptions: any = null;

      // Track options passed to transaction
      const originalTransaction = db.transaction.bind(db);
      db.transaction = async (fn: any, options?: any) => {
        receivedOptions = options;
        return originalTransaction(fn, options);
      };

      @Controller('/timeout')
      class TimeoutController {
        constructor(private transaction: TransactionService) { }

        @Post('/execute')
        async execute() {
          return this.transaction.run(async () => ({ done: true }), { timeout: 5000 });
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(TimeoutController)
        .listen(7092);
      baseURL = 'http://localhost:7092';

      await fetch(`${baseURL}/timeout/execute`, { method: 'POST' });

      expect(receivedOptions).toBeDefined();
      expect(receivedOptions.timeout).toBe(5000);
    });

    test("omits transaction options when none are configured", async () => {
      const db = new MockTransactionalDatabase();
      let receivedArgCount = 0;

      const originalTransaction = db.transaction.bind(db);
      db.transaction = async (...args: [any, any?]) => {
        receivedArgCount = args.length;
        return originalTransaction(args[0], args[1]);
      };

      @Controller('/no-options')
      class NoOptionsController {
        constructor(private transaction: TransactionService) { }

        @Post('/execute')
        async execute() {
          return this.transaction.run(async () => ({ done: true }));
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(NoOptionsController)
        .listen(7094);
      baseURL = 'http://localhost:7094';

      await fetch(`${baseURL}/no-options/execute`, { method: 'POST' });

      expect(receivedArgCount).toBe(1);
    });

    test("concurrent requests have isolated transactions", async () => {
      const db = new MockTransactionalDatabase();
      const requestOrder: string[] = [];

      @Controller('/concurrent')
      class ConcurrentController {
        constructor(private transaction: TransactionService) { }

        @Post('/slow')
        async slow() {
          return this.transaction.run(async () => {
            requestOrder.push('slow-start');
            await new Promise(r => setTimeout(r, 50));
            requestOrder.push('slow-end');
            return { type: 'slow' };
          });
        }

        @Post('/fast')
        async fast() {
          return this.transaction.run(async () => {
            requestOrder.push('fast-start');
            requestOrder.push('fast-end');
            return { type: 'fast' };
          });
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(ConcurrentController)
        .listen(7093);
      baseURL = 'http://localhost:7093';

      // Start slow request first
      const slowPromise = fetch(`${baseURL}/concurrent/slow`, { method: 'POST' });

      // Start fast request immediately after
      await new Promise(r => setTimeout(r, 10));
      const fastPromise = fetch(`${baseURL}/concurrent/fast`, { method: 'POST' });

      await Promise.all([slowPromise, fastPromise]);

      // Fast should complete between slow start and end
      expect(requestOrder).toEqual([
        'slow-start',
        'fast-start',
        'fast-end',
        'slow-end',
      ]);
    });
  });

  // ==========================================
  // PRISMA-STYLE $TRANSACTION TESTS
  // ==========================================

  describe("Prisma-Style Database Support", () => {
    class PrismaLikeDatabase {
      public transactionCount = 0;
      public commitCount = 0;
      public rollbackCount = 0;

      async connect() { }
      async disconnect() { }

      // Prisma uses $transaction instead of transaction
      async $transaction<T>(fn: (tx: any) => Promise<T>, options?: any): Promise<T> {
        this.transactionCount++;
        const tx = {
          user: {
            create: async (data: any) => ({ id: 1, ...data.data }),
            findMany: async () => [],
          },
        };

        try {
          const result = await fn(tx);
          this.commitCount++;
          return result;
        } catch (error) {
          this.rollbackCount++;
          throw error;
        }
      }
    }

    test("supports Prisma-style $transaction method", async () => {
      const prisma = new PrismaLikeDatabase();

      @Controller('/prisma')
      class PrismaController {
        constructor(private transaction: TransactionService) { }

        @Post('/create')
        async create(@Body() body: { name: string }) {
          return this.transaction.run(async (tx) => {
            const user = await tx.user.create({ data: { name: body.name } });
            return user;
          });
        }
      }

      server = await new Server({ isolated: true })
        .use(database(prisma))
        .load(PrismaController)
        .listen(7100);
      baseURL = 'http://localhost:7100';

      const response = await fetch(`${baseURL}/prisma/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John' }),
      });

      const data = await response.json();
      expect(data.name).toBe('John');
      expect(prisma.transactionCount).toBe(1);
      expect(prisma.commitCount).toBe(1);
    });
  });
});
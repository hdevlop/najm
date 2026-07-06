import "reflect-metadata";
import { describe, test, expect, afterEach, beforeEach } from "bun:test";
import { Err, Server } from "najm-core";
import { Controller, Repository, reset, Service } from "najm-core";
import { database, DatabaseService, DB, type DbClient } from "../src";
import { Get, Post, Body, Params } from "najm-core";

// ==========================================
// MOCK DATABASE IMPLEMENTATIONS
// ==========================================

class MockDatabase {
  public connected = false;
  public disconnected = false;
  public queryLog: string[] = [];

  async connect() {
    await new Promise(r => setTimeout(r, 5));
    this.connected = true;
  }

  async disconnect() {
    await new Promise(r => setTimeout(r, 5));
    this.disconnected = true;
  }

  async query(sql: string, params?: any[]) {
    this.queryLog.push(sql);
    return {
      rows: [{ id: 1, data: "mock" }],
      sql,
      params
    };
  }
}

class MockDatabaseNoLifecycle {
  async query(sql: string) {
    return { rows: [], sql };
  }
}

class FailingConnectDatabase {
  async connect() {
    Err("Connection failed: Network timeout");
  }
}

class FailingDisconnectDatabase {
  public connected = false;

  async connect() {
    this.connected = true;
  }

  async disconnect() {
    Err("Disconnect failed: Active transactions");
  }
}

class SlowDatabase {
  public connectTime = 0;

  async connect() {
    const start = Date.now();
    await new Promise(r => setTimeout(r, 50));
    this.connectTime = Date.now() - start;
  }

  async query(sql: string) {
    return { rows: [], sql };
  }
}

class DatabaseWithClient {
  public $client = { connected: true, pool: {} };

  async query(sql: string) {
    return { rows: [], sql };
  }
}

class RedisCache {
  private cache = new Map<string, any>();

  async get(key: string) {
    return this.cache.get(key) || null;
  }

  async set(key: string, value: any) {
    this.cache.set(key, value);
  }

  async del(key: string) {
    this.cache.delete(key);
  }
}

// ==========================================
// TEST SUITE
// ==========================================

describe("DatabaseService Comprehensive Tests", () => {
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
  // BASIC REGISTRATION
  // ==========================================

  describe("Basic Registration", () => {
    test("registers single database as 'default' and connects", async () => {
      const db = new MockDatabase();

      server = await new Server({ isolated: true })
        .use(database(db))
        .listen(6000);

      const dbService = server.container.get(DatabaseService);
      expect(dbService.has('default')).toBe(true);
      expect(dbService.get('default')).toBe(db);
      expect(db.connected).toBe(true);
      expect(db.disconnected).toBe(false);
    });

    test("registers database without lifecycle methods", async () => {
      const db = new MockDatabaseNoLifecycle();

      server = await new Server({ isolated: true })
        .use(database(db))
        .listen(6002);

      const dbService = server.container.get(DatabaseService);
      expect(dbService.has('default')).toBe(true);
    });

    test("registers multiple named databases", async () => {
      const postgres = new MockDatabase();
      const mysql = new MockDatabase();
      const sqlite = new MockDatabase();

      server = await new Server({ isolated: true })
        .use(database({
          postgres,
          mysql,
          sqlite,
        }))
        .listen(6004);

      const dbService = server.container.get(DatabaseService);
      expect(dbService.has('postgres')).toBe(true);
      expect(dbService.has('mysql')).toBe(true);
      expect(dbService.has('sqlite')).toBe(true);
      expect(dbService.getNames()).toEqual(['mysql', 'postgres', 'sqlite']);
    });

    test("registers databases with special name formats", async () => {
      server = await new Server({ isolated: true })
        .use(database({
          'primary-db': new MockDatabase(),
          'cache_db': new MockDatabase(),
          'db.analytics': new MockDatabase(),
        }))
        .listen(7006);

      const dbService = server.container.get(DatabaseService);
      expect(dbService.has('primary-db')).toBe(true);
      expect(dbService.has('cache_db')).toBe(true);
      expect(dbService.has('db.analytics')).toBe(true);
    });
  });

  // ==========================================
  // CONNECTION MANAGEMENT
  // ==========================================

  describe("Connection Management", () => {
    test("connects all databases in parallel", async () => {
      const db1 = new SlowDatabase();
      const db2 = new SlowDatabase();
      const db3 = new SlowDatabase();

      const startTime = Date.now();

      server = await new Server({ isolated: true })
        .use(database({ db1, db2, db3 }))
        .listen(6010);

      const totalTime = Date.now() - startTime;

      // Should be ~50-70ms if parallel, ~150ms if sequential
      expect(totalTime).toBeLessThan(100);
      expect(db1.connectTime).toBeGreaterThan(40);
      expect(db2.connectTime).toBeGreaterThan(40);
      expect(db3.connectTime).toBeGreaterThan(40);
    });

    test("throws error when database connection fails with name", async () => {
      const db = new FailingConnectDatabase();

      await expect(
        new Server({ isolated: true })
          .use(database({ production: db }))
          .listen(6012)
      ).rejects.toThrow();
    });

    test("handles disconnect gracefully and failures without throwing", async () => {
      const goodDb = new MockDatabase();
      const badDb = new FailingDisconnectDatabase();

      server = await new Server({ isolated: true })
        .use(database({ good: goodDb, bad: badDb }))
        .listen(6014);

      const dbService = server.container.get(DatabaseService);
      await expect(async () => { await dbService.clear() }).not.toThrow();

      expect(goodDb.disconnected).toBe(true);
      expect(dbService.isEmpty()).toBe(true);
    });
  });

  // ==========================================
  // GET OPERATIONS
  // ==========================================

  describe("Get Operations", () => {
    test("retrieves database by name and default", async () => {
      const db = new MockDatabase();

      server = await new Server({ isolated: true })
        .use(database(db))
        .listen(6020);

      const dbService = server.container.get(DatabaseService);
      const retrieved1 = dbService.get();
      const retrieved2 = dbService.get('default');

      expect(retrieved1).toBe(db);
      expect(retrieved2).toBe(db);
    });

    test("throws error when database not found", async () => {
      server = await new Server({ isolated: true })
        .use(database({ existing: new MockDatabase() }))
        .listen(6022);

      const dbService = server.container.get(DatabaseService);

      expect(() => dbService.get('nonexistent')).toThrow();
      expect(() => dbService.get('missing-db')).toThrow();
    });

    test("getAll returns all registered databases", async () => {
      const db1 = new MockDatabase();
      const db2 = new MockDatabase();
      const db3 = new MockDatabase();

      server = await new Server({ isolated: true })
        .use(database({
          postgres: db1,
          mysql: db2,
          sqlite: db3,
        }))
        .listen(6023);

      const dbService = server.container.get(DatabaseService);
      const all = dbService.getAll();

      expect(Object.keys(all)).toHaveLength(3);
      expect(all.postgres).toBe(db1);
      expect(all.mysql).toBe(db2);
      expect(all.sqlite).toBe(db3);
    });

    test("get returns same instance on multiple calls", async () => {
      const db = new MockDatabase();

      server = await new Server({ isolated: true })
        .use(database(db))
        .listen(6025);

      const dbService = server.container.get(DatabaseService);
      const instance1 = dbService.get();
      const instance2 = dbService.get();
      const instance3 = dbService.get('default');

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(instance3).toBe(db);
    });
  });

  // ==========================================
  // QUERY OPERATIONS
  // ==========================================

  describe("Query Operations", () => {
    test("has returns true for existing database", async () => {
      server = await new Server({ isolated: true })
        .use(database({
          primary: new MockDatabase(),
          cache: new MockDatabase(),
        }))
        .listen(6030);

      const dbService = server.container.get(DatabaseService);
      expect(dbService.has('primary')).toBe(true);
      expect(dbService.has('cache')).toBe(true);
      expect(dbService.has('nonexistent')).toBe(false);
    });

    test("getNames returns sorted list of database names", async () => {
      server = await new Server({ isolated: true })
        .use(database({
          zebra: new MockDatabase(),
          alpha: new MockDatabase(),
          charlie: new MockDatabase(),
          beta: new MockDatabase(),
        }))
        .listen(6031);

      const dbService = server.container.get(DatabaseService);
      const names = dbService.getNames();

      expect(names).toEqual(['alpha', 'beta', 'charlie', 'zebra']);
    });

    test("DatabaseService is not available if plugin is not used", async () => {
      const server = await new Server({ isolated: true }).listen(6035);
      const isRegistered = server.container.has(DatabaseService);
      expect(isRegistered).toBe(false);
      await server.stop();
    });
  });

  // ==========================================
  // CLEAR OPERATIONS
  // ==========================================

  describe("Clear Operations", () => {
    test("clear disconnects all databases and removes from registry", async () => {
      const db1 = new MockDatabase();
      const db2 = new MockDatabase();
      const db3 = new MockDatabase();

      server = await new Server({ isolated: true })
        .use(database({ db1, db2, db3 }))
        .listen(6040);

      const dbService = server.container.get(DatabaseService);
      expect(dbService.getNames()).toHaveLength(3);

      await dbService.clear();

      expect(db1.disconnected).toBe(true);
      expect(db2.disconnected).toBe(true);
      expect(db3.disconnected).toBe(true);
      expect(dbService.getNames()).toHaveLength(0);
      expect(dbService.isEmpty()).toBe(true);
    });

    test("clear handles databases without disconnect method", async () => {
      const db = new MockDatabaseNoLifecycle();

      server = await new Server({ isolated: true })
        .use(database(db))
        .listen(6042);

      const dbService = server.container.get(DatabaseService);
      await expect(async () => { await dbService.clear() }).not.toThrow();

      expect(dbService.isEmpty()).toBe(true);
    });

    test("clear can be called multiple times safely", async () => {
      server = await new Server({ isolated: true })
        .use(database(new MockDatabase()))
        .listen(6044);

      const dbService = server.container.get(DatabaseService);

      await dbService.clear();
      await dbService.clear();
      await dbService.clear();

      expect(dbService.isEmpty()).toBe(true);
    });
  });

  // ==========================================
  // REPOSITORY INJECTION - BASIC
  // ==========================================

  describe("Repository Injection - Basic", () => {
    test("injects default database into repository", async () => {
      const db = new MockDatabase();

      @Repository('default')
      class UserRepository {
        public db: DbClient

        async getUsers() {
          return this.db.query('SELECT * FROM users');
        }
      }

      @Controller('/users')
      class UserController {
        constructor(private userRepo: UserRepository) { }

        @Get('/')
        async getUsers() {
          const result = await this.userRepo.getUsers();
          return result;
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(UserRepository, UserController)
        .listen(6050);

      baseURL = 'http://localhost:6050';

      const response = await fetch(`${baseURL}/users`);
      const data = await response.json();

      expect(data.sql).toBe('SELECT * FROM users');
      expect(db.queryLog).toContain('SELECT * FROM users');
    });

    test("injects named database into repository", async () => {
      const postgresDb = new MockDatabase();

      @Repository('postgres')
      class PostgresRepository {
        public db: DbClient

        async queryPostgres() {
          return this.db.query('SELECT version()');
        }
      }

      @Controller('/db')
      class DbController {
        constructor(private repo: PostgresRepository) { }

        @Get('/version')
        async getVersion() {
          return this.repo.queryPostgres();
        }
      }

      server = await new Server({ isolated: true })
        .use(database({ postgres: postgresDb }))
        .load(PostgresRepository, DbController)
        .listen(6051);

      baseURL = 'http://localhost:6051';

      const response = await fetch(`${baseURL}/db/version`);
      const data = await response.json();

      expect(data.sql).toBe('SELECT version()');
    });

    test("injects different databases into multiple repositories", async () => {
      const pgDb = new MockDatabase();
      const mysqlDb = new MockDatabase();

      @Repository('postgres')
      class PostgresRepository {
        public db: DbClient

        async query() {
          return this.db.query('PG: SELECT 1');
        }
      }

      @Repository('mysql')
      class MySQLRepository {
        public db: DbClient

        async query() {
          return this.db.query('MYSQL: SELECT 1');
        }
      }

      @Controller('/data')
      class DataController {
        constructor(
          private pgRepo: PostgresRepository,
          private mysqlRepo: MySQLRepository
        ) { }

        @Get('/pg')
        async getPg() {
          return this.pgRepo.query();
        }

        @Get('/mysql')
        async getMysql() {
          return this.mysqlRepo.query();
        }
      }

      server = await new Server({ isolated: true })
        .use(database({
          postgres: pgDb,
          mysql: mysqlDb,
        }))
        .load(PostgresRepository, MySQLRepository, DataController)
        .listen(6052);

      baseURL = 'http://localhost:6052';

      const pgResponse = await fetch(`${baseURL}/data/pg`);
      const pgData = await pgResponse.json();
      expect(pgData.sql).toBe('PG: SELECT 1');

      const mysqlResponse = await fetch(`${baseURL}/data/mysql`);
      const mysqlData = await mysqlResponse.json();
      expect(mysqlData.sql).toBe('MYSQL: SELECT 1');
    });
  });

  // ==========================================
  // VALIDATION & ERROR HANDLING
  // ==========================================

  describe("Validation & Error Handling", () => {
    test("throws error for invalid database names", async () => {
      server = await new Server({ isolated: true })
        .use(database(new MockDatabase()))
        .listen(6060);

      const dbService = server.container.get(DatabaseService);

      await expect(dbService.register('', new MockDatabase())).rejects.toThrow();
      await expect(dbService.register(null as any, new MockDatabase())).rejects.toThrow();
      await expect(dbService.register(undefined as any, new MockDatabase())).rejects.toThrow();
    });

    test("handles duplicate database registration", async () => {
      const db1 = new MockDatabase();
      const db2 = new MockDatabase();

      server = await new Server({ isolated: true })
        .use(database({ mydb: db1 }))
        .listen(6063);

      const dbService = server.container.get(DatabaseService);

      await expect(async () => { await dbService.register('mydb', db2) }).not.toThrow();

      expect(dbService.get('mydb')).toBe(db2);
    });

    test("handles null database instance", async () => {
      server = await new Server({ isolated: true })
        .use(database(new MockDatabase()))
        .listen(6064);

      const dbService = server.container.get(DatabaseService);

      await expect(
        dbService.register('nulldb', null as any)
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // EDGE CASES
  // ==========================================

  describe("Edge Cases", () => {
    test("handles database with $client property", async () => {
      const db = new DatabaseWithClient();

      server = await new Server({ isolated: true })
        .use(database(db))
        .listen(6070);

      const dbService = server.container.get(DatabaseService);
      expect(dbService.has('default')).toBe(true);
      expect(dbService.get('default')).toBe(db);
    });

    test("handles rapid get operations", async () => {
      const db = new MockDatabase();

      server = await new Server({ isolated: true })
        .use(database(db))
        .listen(6074);

      const dbService = server.container.get(DatabaseService);

      // Rapid fire get operations
      const instances = await Promise.all(
        Array(100).fill(0).map(() =>
          Promise.resolve(dbService.get('default'))
        )
      );

      // All should be the same instance
      expect(instances.every(inst => inst === db)).toBe(true);
    });
  });

  // ==========================================
  // @DB() PROPERTY DECORATOR INJECTION
  // ==========================================

  describe("@DB() Property Decorator Injection", () => {
    test("injects default database into service using @DB()", async () => {
      const db = new MockDatabase();

      @Service()
      class UserService {
        @DB() db!: any;

        async getUsers() {
          return this.db.query('SELECT * FROM users');
        }
      }

      @Controller('/users')
      class UserController {
        constructor(private userService: UserService) { }

        @Get('/')
        async list() {
          return this.userService.getUsers();
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(UserService, UserController)
        .listen(6090);

      baseURL = 'http://localhost:6090';

      const response = await fetch(`${baseURL}/users`);
      const data = await response.json();

      expect(data.sql).toBe('SELECT * FROM users');
      expect(db.queryLog).toContain('SELECT * FROM users');
    });

    test("injects named database into service using @DB('name')", async () => {
      const analyticsDb = new MockDatabase();

      @Service()
      class AnalyticsService {
        @DB('analytics') db!: any;

        async trackEvent(event: string) {
          return this.db.query(`INSERT INTO events (name) VALUES ('${event}')`);
        }
      }

      @Controller('/analytics')
      class AnalyticsController {
        constructor(private analytics: AnalyticsService) { }

        @Post('/track')
        async track(@Body() body: { event: string }) {
          return this.analytics.trackEvent(body.event);
        }
      }

      server = await new Server({ isolated: true })
        .use(database({ analytics: analyticsDb }))
        .load(AnalyticsService, AnalyticsController)
        .listen(6091);

      baseURL = 'http://localhost:6091';

      const response = await fetch(`${baseURL}/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'page_view' }),
      });
      const data = await response.json();

      expect(data.sql).toContain('INSERT INTO events');
      expect(analyticsDb.queryLog.length).toBe(1);
    });

    test("injects multiple databases into single service", async () => {
      const primaryDb = new MockDatabase();
      const cacheDb = new MockDatabase();
      const analyticsDb = new MockDatabase();

      @Service()
      class MultiDbService {
        @DB() primary!: any;
        @DB('cache') cache!: any;
        @DB('analytics') analytics!: any;

        async getData() {
          const [data, cached, stats] = await Promise.all([
            this.primary.query('SELECT * FROM data'),
            this.cache.query('GET cache:data'),
            this.analytics.query('SELECT COUNT(*) FROM events'),
          ]);
          return { data, cached, stats };
        }
      }

      @Controller('/multi')
      class MultiController {
        constructor(private service: MultiDbService) { }

        @Get('/')
        async get() {
          return this.service.getData();
        }
      }

      server = await new Server({ isolated: true })
        .use(database({
          default: primaryDb,
          cache: cacheDb,
          analytics: analyticsDb,
        }))
        .load(MultiDbService, MultiController)
        .listen(6092);

      baseURL = 'http://localhost:6092';

      const response = await fetch(`${baseURL}/multi`);
      const data = await response.json();

      expect(data.data.sql).toBe('SELECT * FROM data');
      expect(data.cached.sql).toBe('GET cache:data');
      expect(data.stats.sql).toBe('SELECT COUNT(*) FROM events');
    });

    test("injects database directly into controller using @DB()", async () => {
      const db = new MockDatabase();

      @Controller('/direct')
      class DirectController {
        @DB() db!: any;

        @Get('/users')
        async getUsers() {
          return this.db.query('SELECT * FROM users');
        }

        @Get('/posts')
        async getPosts() {
          return this.db.query('SELECT * FROM posts');
        }
      }

      server = await new Server({ isolated: true })
        .use(database(db))
        .load(DirectController)
        .listen(6093);

      baseURL = 'http://localhost:6093';

      const usersResponse = await fetch(`${baseURL}/direct/users`);
      const usersData = await usersResponse.json();
      expect(usersData.sql).toBe('SELECT * FROM users');

      const postsResponse = await fetch(`${baseURL}/direct/posts`);
      const postsData = await postsResponse.json();
      expect(postsData.sql).toBe('SELECT * FROM posts');

      expect(db.queryLog).toEqual([
        'SELECT * FROM users',
        'SELECT * FROM posts',
      ]);
    });

    test("mixes @DB() decorator with @Repository decorator", async () => {
      const primaryDb = new MockDatabase();
      const legacyDb = new MockDatabase();

      @Repository('legacy')
      class LegacyRepository {
        db!: any;

        async getOldData() {
          return this.db.query('SELECT * FROM legacy_table');
        }
      }

      @Service()
      class MigrationService {
        @DB() primary!: any;

        constructor(private legacy: LegacyRepository) { }

        async migrate() {
          const oldData = await this.legacy.getOldData();
          const inserted = await this.primary.query('INSERT INTO new_table SELECT * FROM legacy');
          return { oldData, inserted };
        }
      }

      @Controller('/migration')
      class MigrationController {
        constructor(private service: MigrationService) { }

        @Post('/run')
        async run() {
          return this.service.migrate();
        }
      }

      server = await new Server({ isolated: true })
        .use(database({
          default: primaryDb,
          legacy: legacyDb,
        }))
        .load(LegacyRepository, MigrationService, MigrationController)
        .listen(6094);

      baseURL = 'http://localhost:6094';

      const response = await fetch(`${baseURL}/migration/run`, { method: 'POST' });
      const data = await response.json();

      expect(data.oldData.sql).toBe('SELECT * FROM legacy_table');
      expect(data.inserted.sql).toBe('INSERT INTO new_table SELECT * FROM legacy');
    });

    test("multiple services share same database instance via @DB()", async () => {
      const sharedDb = new MockDatabase();

      @Service()
      class ServiceA {
        @DB() db!: any;

        async queryA() {
          return this.db.query('QUERY FROM SERVICE A');
        }
      }

      @Service()
      class ServiceB {
        @DB() db!: any;

        async queryB() {
          return this.db.query('QUERY FROM SERVICE B');
        }
      }

      @Controller('/shared')
      class SharedController {
        constructor(
          private serviceA: ServiceA,
          private serviceB: ServiceB
        ) { }

        @Get('/both')
        async queryBoth() {
          const [a, b] = await Promise.all([
            this.serviceA.queryA(),
            this.serviceB.queryB(),
          ]);
          return { a, b };
        }
      }

      server = await new Server({ isolated: true })
        .use(database(sharedDb))
        .load(ServiceA, ServiceB, SharedController)
        .listen(6096);

      baseURL = 'http://localhost:6096';

      const response = await fetch(`${baseURL}/shared/both`);
      const data = await response.json();

      expect(data.a.sql).toBe('QUERY FROM SERVICE A');
      expect(data.b.sql).toBe('QUERY FROM SERVICE B');

      // Both queries logged in same db instance
      expect(sharedDb.queryLog).toEqual([
        'QUERY FROM SERVICE A',
        'QUERY FROM SERVICE B',
      ]);
    });

    test("@DB() with nonexistent database throws error", async () => {
      const existingDb = new MockDatabase();

      @Service()
      class BrokenService {
        @DB('nonexistent') db!: any;

        async query() {
          return this.db?.query('test') ?? { error: 'no db' };
        }
      }

      @Controller('/broken')
      class BrokenController {
        constructor(private service: BrokenService) { }

        @Get('/')
        async get() {
          return this.service.query();
        }
      }

      await expect(
        new Server({ isolated: true })
          .use(database({ existing: existingDb }))
          .load(BrokenService, BrokenController)
          .listen(6097)
      ).rejects.toThrow();
    });

    test("read/write split with @DB() decorators", async () => {
      const writeDb = new MockDatabase();
      const readDb = new MockDatabase();

      @Service()
      class UserService {
        @DB('write') writer!: any;
        @DB('read') reader!: any;

        async createUser(name: string, email: string) {
          return this.writer.query(
            `INSERT INTO users (name, email) VALUES ('${name}', '${email}')`
          );
        }

        async getUser(id: number) {
          return this.reader.query(`SELECT * FROM users WHERE id = ${id}`);
        }

        async listUsers() {
          return this.reader.query('SELECT * FROM users');
        }
      }

      @Controller('/users')
      class UserController {
        constructor(private users: UserService) { }

        @Get('/')
        async list() {
          return this.users.listUsers();
        }

        @Get('/:id')
        async get(@Params('id') id: string) {
          return this.users.getUser(parseInt(id));
        }

        @Post('/')
        async create(@Body() body: { name: string; email: string }) {
          return this.users.createUser(body.name, body.email);
        }
      }

      server = await new Server({ isolated: true })
        .use(database({
          write: writeDb,
          read: readDb,
        }))
        .load(UserService, UserController)
        .listen(6098);

      baseURL = 'http://localhost:6098';

      // Create uses write db
      await fetch(`${baseURL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', email: 'john@test.com' }),
      });

      // List uses read db
      await fetch(`${baseURL}/users`);

      // Get uses read db
      await fetch(`${baseURL}/users/1`);

      expect(writeDb.queryLog).toHaveLength(1);
      expect(writeDb.queryLog[0]).toContain('INSERT INTO users');

      expect(readDb.queryLog).toHaveLength(2);
      expect(readDb.queryLog[0]).toBe('SELECT * FROM users');
      expect(readDb.queryLog[1]).toBe('SELECT * FROM users WHERE id = 1');
    });
  });

  // ==========================================
  // REAL-WORLD SCENARIOS
  // ==========================================

  describe("Real-World Scenarios", () => {
    test("Multi-tenant SaaS application", async () => {
      @Repository('tenant_a')
      class TenantARepository {
        public db: DbClient

        async getUsers() {
          return this.db.query('SELECT * FROM tenant_a.users');
        }

        async getOrders() {
          return this.db.query('SELECT * FROM tenant_a.orders');
        }
      }

      @Repository('tenant_b')
      class TenantBRepository {
        public db: DbClient

        async getUsers() {
          return this.db.query('SELECT * FROM tenant_b.users');
        }

        async getOrders() {
          return this.db.query('SELECT * FROM tenant_b.orders');
        }
      }

      @Controller('/tenants/:tenant')
      class TenantController {
        constructor(
          private tenantA: TenantARepository,
          private tenantB: TenantBRepository
        ) { }

        @Get('/users')
        async getUsers(@Params('tenant') tenant: string) {
          if (tenant === 'a') {
            return this.tenantA.getUsers();
          }
          return this.tenantB.getUsers();
        }

        @Get('/orders')
        async getOrders(@Params('tenant') tenant: string) {
          if (tenant === 'a') {
            return this.tenantA.getOrders();
          }
          return this.tenantB.getOrders();
        }
      }

      server = await new Server({ isolated: true })
        .use(database({
          tenant_a: new MockDatabase(),
          tenant_b: new MockDatabase(),
        }))
        .load(TenantARepository, TenantBRepository, TenantController)
        .listen(6080);

      baseURL = 'http://localhost:6080';

      const userAResponse = await fetch(`${baseURL}/tenants/a/users`);
      const userAData = await userAResponse.json();
      expect(userAData.sql).toBe('SELECT * FROM tenant_a.users');

      const userBResponse = await fetch(`${baseURL}/tenants/b/users`);
      const userBData = await userBResponse.json();
      expect(userBData.sql).toBe('SELECT * FROM tenant_b.users');

      const orderAResponse = await fetch(`${baseURL}/tenants/a/orders`);
      const orderAData = await orderAResponse.json();
      expect(orderAData.sql).toBe('SELECT * FROM tenant_a.orders');
    });

    test("Read-write split with primary and replica", async () => {
      @Repository('primary')
      class WriteRepository {
        public db: DbClient

        async createUser(name: string, email: string) {
          return this.db.query(
            'INSERT INTO users (name, email) VALUES (?, ?)',
            [name, email]
          );
        }

        async updateUser(id: number, data: any) {
          return this.db.query(
            'UPDATE users SET name = ? WHERE id = ?',
            [data.name, id]
          );
        }
      }

      @Repository('replica')
      class ReadRepository {
        public db: DbClient

        async findAll() {
          return this.db.query('SELECT * FROM users');
        }

        async findById(id: number) {
          return this.db.query('SELECT * FROM users WHERE id = ?', [id]);
        }
      }

      @Controller('/users')
      class UserController {
        constructor(
          private writeRepo: WriteRepository,
          private readRepo: ReadRepository
        ) { }

        @Get('/')
        async list() {
          return this.readRepo.findAll();
        }

        @Get('/:id')
        async getOne(@Params('id') id: string) {
          return this.readRepo.findById(parseInt(id));
        }

        @Post('/')
        async create(@Body() body: { name: string; email: string }) {
          return this.writeRepo.createUser(body.name, body.email);
        }

        @Post('/:id')
        async update(@Params('id') id: string, @Body() body: any) {
          return this.writeRepo.updateUser(parseInt(id), body);
        }
      }

      server = await new Server({ isolated: true })
        .use(database({
          primary: new MockDatabase(),
          replica: new MockDatabase(),
        }))
        .load(WriteRepository, ReadRepository, UserController)
        .listen(6081);

      baseURL = 'http://localhost:6081';

      // Read operations go to replica
      const listResponse = await fetch(`${baseURL}/users`);
      const listData = await listResponse.json();
      expect(listData.sql).toBe('SELECT * FROM users');

      const getResponse = await fetch(`${baseURL}/users/1`);
      const getData = await getResponse.json();
      expect(getData.sql).toBe('SELECT * FROM users WHERE id = ?');

      // Write operations go to primary
      const createResponse = await fetch(`${baseURL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
      });
      const createData = await createResponse.json();
      expect(createData.sql).toBe('INSERT INTO users (name, email) VALUES (?, ?)');
    });

    test("Microservices architecture with service databases", async () => {
      @Repository('users_db')
      class UsersRepository {
        public db: DbClient

        async getUsers() {
          return this.db.query('SELECT * FROM users');
        }
      }

      @Repository('orders_db')
      class OrdersRepository {
        public db: DbClient

        async getOrders() {
          return this.db.query('SELECT * FROM orders');
        }
      }

      @Repository('inventory_db')
      class InventoryRepository {
        public db: DbClient

        async getProducts() {
          return this.db.query('SELECT * FROM products');
        }
      }

      @Repository('analytics_db')
      class AnalyticsRepository {
        public db: DbClient

        async getStats() {
          return this.db.query('SELECT * FROM analytics_events');
        }
      }

      @Controller('/api')
      class ApiController {
        constructor(
          private users: UsersRepository,
          private orders: OrdersRepository,
          private inventory: InventoryRepository,
          private analytics: AnalyticsRepository
        ) { }

        @Get('/dashboard')
        async getDashboard() {
          const [users, orders, products, stats] = await Promise.all([
            this.users.getUsers(),
            this.orders.getOrders(),
            this.inventory.getProducts(),
            this.analytics.getStats(),
          ]);

          return { users, orders, products, stats };
        }
      }

      server = await new Server({ isolated: true })
        .use(database({
          users_db: new MockDatabase(),
          orders_db: new MockDatabase(),
          inventory_db: new MockDatabase(),
          analytics_db: new MockDatabase(),
        }))
        .load(UsersRepository, OrdersRepository, InventoryRepository, AnalyticsRepository, ApiController)
        .listen(6082);

      baseURL = 'http://localhost:6082';

      const response = await fetch(`${baseURL}/api/dashboard`);
      const data = await response.json();

      expect(data.users.sql).toBe('SELECT * FROM users');
      expect(data.orders.sql).toBe('SELECT * FROM orders');
      expect(data.products.sql).toBe('SELECT * FROM products');
      expect(data.stats.sql).toBe('SELECT * FROM analytics_events');
    });

    test("Caching layer with Redis and PostgreSQL", async () => {
      @Repository('cache')
      class CacheRepository {
        public db: DbClient

        async get(key: string) {
          return this.db.get(key);
        }

        async set(key: string, value: any) {
          return this.db.set(key, value);
        }

        async invalidate(key: string) {
          return this.db.del(key);
        }
      }

      @Repository('postgres')
      class PostgresRepository {
        public db: DbClient

        async getUser(id: number) {
          return this.db.query('SELECT * FROM users WHERE id = ?', [id]);
        }
      }

      @Controller('/users')
      class UserController {
        constructor(
          private cache: CacheRepository,
          private db: PostgresRepository
        ) { }

        @Get('/:id')
        async getUser(@Params('id') id: string) {
          const cacheKey = `user:${id}`;

          // Try cache first
          let user = await this.cache.get(cacheKey);

          if (user) {
            return { ...user, source: 'cache' };
          }

          // Fallback to database
          user = await this.db.getUser(parseInt(id));

          // Cache for next time
          await this.cache.set(cacheKey, user);

          return { ...user, source: 'database' };
        }

        @Post('/:id/invalidate')
        async invalidateCache(@Params('id') id: string) {
          await this.cache.invalidate(`user:${id}`);
          return { invalidated: true };
        }
      }

      server = await new Server({ isolated: true })
        .use(database({
          cache: new RedisCache(),
          postgres: new MockDatabase(),
        }))
        .load(CacheRepository, PostgresRepository, UserController)
        .listen(6083);

      baseURL = 'http://localhost:6083';

      // First request - from database
      const response1 = await fetch(`${baseURL}/users/1`);
      const data1 = await response1.json();
      expect(data1.source).toBe('database');

      // Second request - from cache
      const response2 = await fetch(`${baseURL}/users/1`);
      const data2 = await response2.json();
      expect(data2.source).toBe('cache');

      // Invalidate cache
      await fetch(`${baseURL}/users/1/invalidate`, { method: 'POST' });

      // Third request - from database again
      const response3 = await fetch(`${baseURL}/users/1`);
      const data3 = await response3.json();
      expect(data3.source).toBe('database');
    });

    test("Event sourcing with write and read models (CQRS)", async () => {
      @Repository('events')
      class EventStoreRepository {
        public db: DbClient
        private eventLog: any[] = [];

        async appendEvent(event: any) {
          const result = await this.db.query(
            'INSERT INTO events (type, data, timestamp) VALUES (?, ?, ?)',
            [event.type, JSON.stringify(event.data), Date.now()]
          );
          this.eventLog.push(event);
          return result;
        }

        async getEvents() {
          return this.eventLog;
        }
      }

      @Repository('projections')
      class ProjectionRepository {
        public db: DbClient

        async getUserBalance(userId: number) {
          return this.db.query(
            'SELECT balance FROM user_balances WHERE user_id = ?',
            [userId]
          );
        }
      }

      @Controller('/banking')
      class BankingController {
        constructor(
          private eventStore: EventStoreRepository,
          private projections: ProjectionRepository
        ) { }

        @Post('/deposit')
        async deposit(@Body() body: { userId: number; amount: number }) {
          // Write to event store
          await this.eventStore.appendEvent({
            type: 'MoneyDeposited',
            data: { userId: body.userId, amount: body.amount },
          });

          return { success: true };
        }

        @Get('/balance/:userId')
        async getBalance(@Params('userId') userId: string) {
          // Read from projection
          return this.projections.getUserBalance(parseInt(userId));
        }

        @Get('/events')
        async getEvents() {
          return this.eventStore.getEvents();
        }
      }

      server = await new Server({ isolated: true })
        .use(database({
          events: new MockDatabase(),
          projections: new MockDatabase(),
        }))
        .load(EventStoreRepository, ProjectionRepository, BankingController)
        .listen(6084);

      baseURL = 'http://localhost:6084';

      // Deposit money (write to event store)
      await fetch(`${baseURL}/banking/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 1, amount: 100 }),
      });

      // Check events
      const eventsResponse = await fetch(`${baseURL}/banking/events`);
      const eventsData = await eventsResponse.json();
      expect(eventsData).toHaveLength(1);
      expect(eventsData[0].type).toBe('MoneyDeposited');

      // Check balance (read from projection)
      const balanceResponse = await fetch(`${baseURL}/banking/balance/1`);
      const balanceData = await balanceResponse.json();
      expect(balanceData.sql).toContain('user_balances');
    });
  });
});
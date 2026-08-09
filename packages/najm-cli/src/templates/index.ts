export const TS_CONFIG = `
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "strict": false,
    "declaration": true,
    "declarationMap": false,
    "skipLibCheck": true,
    "emitDeclarationOnly": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "test"]
}
`
export const MAIN_CONTENT = `
import { Server } from 'najm-api';
import './modules';

await Server({ port: {{port}} });
`
export const BUN_MAIN_CONTENT = `
import { Server } from 'najm-api';
import './modules';
await Server({ port: {{port}} });
`;
export const NODE_MAIN_CONTENT = `
import { Server } from 'najm-api';
import { {{moduleName}}Controller } from './modules/{{moduleName}}s/{{moduleName}}Controller';

await Server({ 
  port: {{port}},
  controllers:[
    {{moduleName}}Controller,
  ]
});

`;

export const SERVICE_CONTENT = `
import { Injectable } from 'najm-api';
import { {{moduleName}}Repository } from './{{moduleName}}Repository';

@Service()
export class {{moduleName}}Service {
  constructor(private {{moduleName}}Repository: {{moduleName}}Repository) {}

  async getAll() {
    return await this.{{moduleName}}Repository.getAll();
  }

  async getById(id) {
    return await this.{{moduleName}}Repository.getById(id);
  }

  async create(data) {
    return await this.{{moduleName}}Repository.create(data);
  }

  async update(id, data) {
    return await this.{{moduleName}}Repository.update(id, data);
  }

  async delete(id) {
    return await this.{{moduleName}}Repository.delete(id);
  }
}
`;
export const CONTROLLER_CONTENT = `
import { Controller, Get, Post, Put, Delete } from 'najm-api';
import { {{moduleName}}Service } from './{{moduleName}}Service';

@Controller('/{{moduleName}}s')
export class {{moduleName}}Controller {
  constructor(private {{moduleName}}Service: {{moduleName}}Service) {}
  
  @Get()
  async get{{moduleNameUpper}}s() {
    return await this.{{moduleName}}Service.getAll();
  }
  
  @Get('/:id')
  async get{{moduleNameUpper}}(params) {
    return await this.{{moduleName}}Service.getById(params.id);
  }
  
  @Post()
  async create{{moduleNameUpper}}(body) {
    return await this.{{moduleName}}Service.create(body);
  }

  @Put('/:id')
  async update{{moduleNameUpper}}(params, body) {
    return await this.{{moduleName}}Service.update(params.id, body);
  }

  @Delete('/:id')
  async delete{{moduleNameUpper}}(params) {
    return await this.{{moduleName}}Service.delete(params.id);
  }
}
`;
export const REPOSITORY_CONTENT = `
import { Repository } from '../../shared/decorators';
import { DB } from '../../database/db'
import { {{moduleName}}s } from '../../database/schema';
import { eq } from 'drizzle-orm';

@Repository()
export class {{moduleName}}Repository {

  declare db: DB;

  async getAll() {
    return await this.db.select().from({{moduleName}}s);
  }

  async getById(id) {
    const results = await this.db.select().from({{moduleName}}s)
      .where(eq({{moduleName}}s.id, id))
      .limit(1);
    return results[0] || null;
  }

  async create(data) {
    return await this.db.insert({{moduleName}}s).values(data).returning();
  }

  async update(id, data) {
    return await this.db.update({{moduleName}}s)
      .set(data)
      .where(eq({{moduleName}}s.id, id))
      .returning();
  }

  async delete(id) {
    return await this.db.delete({{moduleName}}s)
      .where(eq({{moduleName}}s.id, id))
      .returning();
  }
}
`;

export const MODULE_INDEX_CONTENT = `
export * from './{{moduleName}}Controller';
export * from './{{moduleName}}Service';
export * from './{{moduleName}}Repository';
`
export const MODULES_INDEX_CONTENT = `
export * from './{{moduleName}}s';
`
export const API_TEST_CONTENT = `
@baseUrl = http://localhost:3000

### Variables for request body
@userId = usr_7HjKl8Ms9n
@name = New User
@email = new@example.com

### Get all {{moduleName}}s
GET {{baseUrl}}/{{moduleName}}s

### Get specific {{moduleName}}
GET {{baseUrl}}/{{moduleName}}s/{{userId}}

### Create new user
POST {{baseUrl}}/users
Content-Type: application/json

{
  "name": "{{name}}",
  "email": "{{email}}",
  "password": "securePassword123",
  "image": "https://example.com/profile.jpg",
  "status": "active",
  "roleId": "r_9jPqR5sZ1"
}

### Update user
PUT {{baseUrl}}/users/{{userId}}
Content-Type: application/json

{
  "name": "Updated User",
  "email": "updated@example.com",
  "status": "active"
}
  
### Delete user
DELETE {{baseUrl}}/users/{{userId}}

`
export const PACKAGE_JSON_TEMPLATE = `{
  "name": "{{projectName}}",
  "version": "{{version}}",
  "description": "{{description}}",
  "author": "{{author}}",
  "license": "MIT",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "{{runtime}} src/index.ts",
    "dev": "{{runtime}} --watch src/index.ts",
    "build": "tsc",
    "test": "echo \\"Error: no test specified\\" && exit 1"
  },
  "keywords": [
    "najm-api",
    "hono",
    "api"
  ] 
}`
export const DRIZZLE_CONFIG_TEMPLATE = {
  pg: `import type { Config } from 'drizzle-kit';
  
  export default {
     schema: './{{basePath}}/database/schema/*.ts',
     out: './{{basePath}}/database/migrations',
     dialect: 'postgresql',
     dbCredentials: {
        url: process.env.DB_URL!,
     },
  } satisfies Config;`,

  mysql: `import type { Config } from 'drizzle-kit';
  
  export default {
     schema: './{{basePath}}/database/schema/*.ts',
     out: './{{basePath}}/database/migrations',
     dialect: 'mysql',
     dbCredentials: {
        url: process.env.DB_URL!,
     },
  } satisfies Config;`,

  sqlite: `import type { Config } from 'drizzle-kit';
  
  export default {
     schema: './{{basePath}}/database/schema/*.ts',
     out: './{{basePath}}/database/migrations',
     dialect: 'sqlite',
     dbCredentials: {
        url: process.env.DB_URL!.replace('file:', ''),
     },
  } satisfies Config;`
};
export const DB_TEMPLATES = {
  pg: `import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
  import * as schema from './schema';
  
  export type DB = PostgresJsDatabase<typeof schema>;
  export const db: DB = drizzle(process.env.DB_URL);`,
  
  mysql: `import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
  import * as schema from './schema';
  
  export type DB = MySql2Database<typeof schema>;
  export const db: DB = drizzle(process.env.DB_URL);`,
  
  sqlite: `import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
  import * as schema from './schema';
  
  export type DB = BetterSQLite3Database<typeof schema>;
  export const db: DB = drizzle(process.env.DB_URL);`,
};
export const DB_TEST_TEMPLATES = {
  pg: `import { db } from '../db';

async function testConnection() {
  try {
    console.log('Testing PostgreSQL connection...');
    const result = await db.execute('select 1');
    console.log('✅ Successfully connected to PostgreSQL database');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL database:', error);
    process.exit(1);
  }
}

testConnection();`,

  mysql: `import { db } from '../db';
import { sql } from 'drizzle-orm';

async function testConnection() {
  try {
    console.log('Testing MySQL connection...');
    const response = await db.select().from(sql\`DUAL\`);
    console.log('✅ Successfully connected to MySQL database');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to connect to MySQL database:', error);
    process.exit(1);
  }
}

testConnection();`,

  sqlite: `import { db } from '../db';

function testConnection() {
  try {
    console.log('Testing SQLite connection...');
    const result = await db.execute('select 1');
    console.log('✅ Successfully connected to SQLite database');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to connect to SQLite database:', error);
    process.exit(1);
  }
}

testConnection();`
};
export const SCHEMA_TEMPLATES = {
  pg: `import { pgTable, serial, text, timestamp, boolean, integer, numeric, uniqueIndex } from 'drizzle-orm/pg-core';

import { nanoid } from 'nanoid';
// Users table with common fields
export const users = pgTable('users', {
  id: text('id').primaryKey().notNull().$defaultFn(() => nanoid()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').default(false),
  password: text('password').notNull(),
  image: text('image'),
  status: text('status').default('pending'),
  roleId: text('roleId').references(() => roles.id),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow(),
});

export const roles = pgTable('roles', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  description: text('description'),
});
`,

  mysql: `import { mysqlTable, serial, varchar, timestamp, boolean, int, decimal, uniqueIndex } from 'drizzle-orm/mysql-core';
import { nanoid } from 'nanoid';
// Users table with common fields
export const roles = mysqlTable('roles', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
});

export const users = mysqlTable('users', {
  id: varchar('id', { length: 255 }).primaryKey().notNull().$defaultFn(() => nanoid()),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('emailVerified').default(false),
  password: varchar('password', { length: 255 }).notNull(),
  image: varchar('image', { length: 255 }),
  status: varchar('status', { length: 255 }).default('pending'),
  roleId: varchar('roleId', { length: 255 }).references(() => roles.id),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
});
`,

  sqlite: `import { sqliteTable, integer, text, blob, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
// Users table with common fields
export const users = sqliteTable('users', {
  id: text('id').primaryKey().notNull().$defaultFn(() => nanoid()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false),
  password: text('password').notNull(),
  image: text('image'),
  status: text('status').default('pending'),
  roleId: text('roleId').references(() => roles.id),
  createdAt: timestamp('createdAt').defaultNow(sql'CURRENT_TIMESTAMP'),
  updatedAt: timestamp('updatedAt').defaultNow(sql'CURRENT_TIMESTAMP'),
});

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  description: text('description'),
});
`
};
export const DB_DECORATORS_TEMPLATE = `
import { Injectable } from 'najm-api';
import { db } from '../../database/db';

/**
 * Repository decorator for database-backed services
 * Automatically injects the database instance and applies Injectable
 */
export function Repository() {
    return function <T extends new (...args: any[]) => any>(target: T): T {
        Injectable()(target);
        
        Object.defineProperty(target.prototype, 'db', {
            get: function () {
                return db;
            },
            configurable: true
        });
        
        return target as T & { prototype: any };
    };
}

/**
 * DB property decorator for injecting the database instance
 * Usage: @DB() private database: DB;
 */
export function DB() {
    return function(target: any, propertyKey: string) {
        const descriptor = {
            get: function() {
                return db;
            },
            enumerable: true,
            configurable: true
        };
        
        Object.defineProperty(target, propertyKey, descriptor);
    };
}
`;
export const NEXT_TEMPLATE = `
import { Server } from 'najm-api';
import  './modules'

const app = await Server({
  serverless: true,
  basePath: '/api',
});

export default app
`

// The App Router auth boundary is exactly three files. auth.ts is reachable
// from the browser and the Edge; session.ts must never be. They cannot be
// merged — see najm-auth's README, "auth.ts and session.ts cannot be merged".

export const AUTH_CONFIG_TEMPLATE = `import { defineAuth } from 'najm-auth/client/server';

/**
 * Browser, server, and Edge safe. Everything app-specific lives here: routes,
 * cookie names, and role mapping. Never import najm-auth/client/server/react
 * from this file — the proxy and every Client Component reach it.
 */
export const auth = defineAuth({
  apiBaseURL: '/api',
  authPrefix: '/auth',
  loginRoute: '/login',
  forbiddenRoute: '/forbidden',
  publicRoutes: ['/', '/login'],
  protectedRoutes: ['/dashboard/:path*'],
  roleRoutes: {},
  verifyAlways: true,
});
`;

export const SESSION_TEMPLATE = `import 'server-only';

import { createReactServerAuth } from 'najm-auth/client/server/react';

import { auth } from './auth';

/**
 * The app's one request-scoped session accessor.
 *
 * The factory must run exactly once, at module scope. React's cache() keys on
 * the function identity it returns, so a second instance — or one built inside
 * a layout, page, or helper — resolves the session again instead of sharing
 * this render's result.
 *
 * Server Components only. Route handlers, the proxy, and scripts keep using the
 * core auth methods.
 */
export const serverAuth = createReactServerAuth(auth);
`;

export const PROXY_TEMPLATE = `import { auth } from '@/lib/auth';

// Edge runtime: core auth only. Importing @/lib/session here would pull React
// into the middleware bundle and fail the build.
export default auth.middleware;
export const config = auth.config;
`;

export const PROTECTED_LAYOUT_TEMPLATE = `import { serverAuth } from '@/lib/session';

// A protected tree reads the per-request session cookie, so it cannot be
// prerendered. Without this, requireSession() runs at build time with no
// request and correctly fails as a configuration error.
export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await serverAuth.requireSession();

  return <>{children}</>;
}
`;

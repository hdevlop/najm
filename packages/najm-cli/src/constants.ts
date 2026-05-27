// constants.ts

export const DATABASE_PACKAGES = {
  pg: {
    dependencies: ['postgres', 'drizzle-orm'],
    devDependencies: ['drizzle-kit', '@types/pg']
  },
  mysql: {
    dependencies: ['mysql2', 'drizzle-orm'],
    devDependencies: ['drizzle-kit', '@types/mysql']
  },
  sqlite: {
    dependencies: ['better-sqlite3', 'drizzle-orm'],
    devDependencies: ['drizzle-kit', '@types/better-sqlite3']
  }
};

export const DATABASE_SCRIPTS = {
  'db:generate': 'drizzle-kit generate --config=drizzle.config.ts',
  'db:push': 'drizzle-kit push --config=drizzle.config.ts',
  'db:drop': 'drizzle-kit drop --config=drizzle.config.ts',
  'db:check': 'drizzle-kit check --config=drizzle.config.ts',
};

export const DEFAULT_CONFIG = {
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'postgres'
};
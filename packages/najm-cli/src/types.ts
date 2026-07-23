// types.ts
import type { text, select, confirm } from '@clack/prompts';

export type DBtype = 'pg' | 'mysql' | 'sqlite';

export interface FolderPaths {
  ROOT: string;
  BASE_FOLDER: string;
  DB_FOLDER: string;
  DB_SCHEMA_FOLDER: string;
  DB_MIGRATION_FOLDER: string;
  DB_TESTS_FOLDER: string;
}

export interface FilePaths {
  DB_FILE: string;
  DRIZZLE_CONFIG: string;
  SCHEMA_INDEX: string;
  TEST_CONNECTION: string;
}

export interface ProjectPaths {
  folders: FolderPaths;
  files: FilePaths;
}

export interface PostgresConfig {
  type: 'pg';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  url: string;
}

export interface MySQLConfig {
  type: 'mysql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  url: string;
}

export interface SQLiteConfig {
  type: 'sqlite';
  database: string;
  url: string;
}

export type DatabaseConfig = PostgresConfig | MySQLConfig | SQLiteConfig;

export type GenerateType = 'module' | 'controller' | 'service';

export interface GenerateOptions {
   name: string;
   type: GenerateType;
   basePath?: string;
   force?: boolean;
 }
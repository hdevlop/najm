// ============================================================================
// najm-storage - Types
// ============================================================================

import type { FileCategory } from './fileUtils';

export type StorageBackend = 'local' | 'database';
export type StorageDialect = 'sqlite' | 'pg' | 'mysql';

export interface BucketConfig {
  name: string;
  label?: string;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  protected?: boolean;
}

export interface StorageConfig {
  /** Storage backend: 'local' (filesystem) or 'database' (drizzle via @DB()). Default: 'local' */
  provider?: StorageBackend;
  /** Register MCP tools for file operations (default: false) */
  mcp?: boolean;
  /** Required when provider is 'database' — auto-selects schema */
  dialect?: StorageDialect;
  /** Explicit drizzle schema override (advanced use — takes priority over dialect) */
  schema?: StorageSchema;
  /** Named database connection from najm-database (default: 'default') */
  database?: string;
  /** Local provider only — base directory for file storage (default: 'storage') */
  basePath?: string;
  /** Max file size in bytes (default: 10 MB) */
  maxFileSize?: number;
  /** Restrict uploads to these categories only */
  allowedCategories?: FileCategory[];
  /** Extensions always blocked regardless of category */
  blockedExtensions?: string[];
  /** Listen to 'namespace:deleted' events and cascade-delete files (default: true) */
  enableCascadeDelete?: boolean;
  /** HTTP Cache-Control max-age in seconds for served files (default: 31536000) */
  cacheMaxAge?: number;
  /**
   * URL prefix prepended to serve paths returned by getServePath() and processFile().
   * Set to '/api' if your storage controller is mounted under /api.
   * Default: ''
   */
  servePrefix?: string;
  /**
   * Register admin Studio API at /storage-studio.
   * Requires the database plugin for audit/activity metadata.
   * Default: false
   */
  studio?: boolean;
  /**
   * Fixed buckets that are auto-created on boot and always visible.
   * Can be a list of names or full BucketConfig objects.
   */
  buckets?: (string | BucketConfig)[];
}

// ============================================================================
// DX Types — higher-level helpers
// ============================================================================

/**
 * Options for processFile() — the smart file handler that accepts
 * File | string | null/undefined and resolves to a stored path.
 */
export interface ProcessFileOptions {
  /**
   * Explicit file path to save under within the namespace.
   * If omitted, derived from the File name (e.g. 'avatar.png').
   */
  filePath?: string;
  /**
   * Fallback path to return when input is null/undefined and no file was uploaded.
   * Takes priority over all other fallbacks.
   */
  fallback?: string;
}

export interface FileInfo {
  namespace: string;
  filePath: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  tags?: string[];
}

export interface FileAnalysis {
  fileName: string;
  extension: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  type: string;
}

export interface ValidateUploadOptions {
  maxSize?: number;
  allowedCategories?: FileCategory[];
  skipSecurity?: boolean;
}

export interface StorageFileDto {
  namespace: string;
  path: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  createdAt: string;
  updatedAt: string;
}

export interface IStorageProvider {
  get(namespace: string, filePath: string): Promise<Buffer | null>;
  getInfo(namespace: string, filePath: string): Promise<FileInfo | null>;
  save(namespace: string, filePath: string, data: Buffer, mimeType: string): Promise<void>;
  delete(namespace: string, filePath: string): Promise<boolean>;
  list(namespace: string): Promise<FileInfo[]>;
  deleteAll(namespace: string): Promise<void>;
  copy(sourceNs: string, targetNs: string): Promise<void>;
  listObjects?(namespace: string, options?: ListOptions): Promise<ListResult>;
  listNamespaces?(): Promise<NamespaceInfo[]>;
  listTrash?(): Promise<FileInfo[]>;
  move?(namespace: string, from: string, to: string): Promise<void>;
  copyFile?(namespace: string, from: string, to: string): Promise<void>;
  softDelete?(namespace: string, filePath: string): Promise<boolean>;
  restore?(namespace: string, filePath: string): Promise<boolean>;
  presign?(namespace: string, filePath: string, method: string, ttlSeconds: number): Promise<string>;
  // Bucket management
  listBuckets?(): Promise<BucketConfig[]>;
  createBucket?(config: BucketConfig): Promise<void>;
  updateBucket?(name: string, config: Partial<BucketConfig>): Promise<void>;
  deleteBucket?(name: string): Promise<void>;
}

export interface ListOptions {
  prefix?: string;
  delimiter?: string;
  cursor?: string;
  limit?: number;
  includeDeleted?: boolean;
}

export interface ListResult {
  files: FileInfo[];
  folders?: string[];
  nextCursor?: string | null;
}

export interface NamespaceInfo {
  name: string;
  fileCount: number;
  totalBytes: number;
  isPrivate?: boolean;
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  namespace: string;
  path?: string;
  meta?: Record<string, unknown>;
  ts: string;
}

export interface UsageCategory {
  category: string;
  count: number;
  bytes: number;
}

export interface UsageSummary {
  totalBytes: number;
  totalCount: number;
  categories: UsageCategory[];
}

export interface StorageSchema {
  storageFiles: any;
  storageBuckets?: any;
  fileTags?: any;
  auditLog?: any;
}

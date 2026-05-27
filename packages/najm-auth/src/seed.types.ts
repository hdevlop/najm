/**
 * Shared user configuration for seeding
 */
export interface SeedUserConfig {
  email: string;
  password: string;
  roleName: string;
  emailVerified?: boolean;
  status?: 'active' | 'inactive' | 'pending';
  image?: string;
  username?: string;
  name?: string;
}

/**
 * Low-level factory config (for use with SeedService)
 */
export interface AuthSeedConfig {
  adminEmail: string;
  adminPass: string;
  roles?: Array<{ name: string; description?: string }>;
  permissions?: Array<{
    action: string;
    resource: string;
    name: string;
    description?: string;
  }>;
  additionalUsers?: SeedUserConfig[];
}

/**
 * High-level standalone function config
 */
export interface SeedAuthDataConfig {
  /** Drizzle database instance (required) */
  db: any;

  /** Admin email (required) */
  adminEmail: string;

  /** Admin password (required) */
  adminPassword: string;

  /** Additional users to seed (optional) */
  users?: SeedUserConfig[];

  /** Custom roles (optional - uses defaults if omitted) */
  roles?: Array<{ name: string; description?: string }>;

  /** Custom permissions (optional - uses defaults if omitted) */
  permissions?: Array<{
    action: string;
    resource: string;
    name: string;
    description?: string;
  }>;

  /** Show verbose logging (optional) */
  verbose?: boolean;

  /** Conflict handling strategy (optional) */
  onConflict?: 'skip' | 'replace' | 'fail';
}

/**
 * Result of seedAuthData operation
 */
export interface SeedAuthDataResult {
  inserted: number;
  skipped: number;
  failed: number;
  users: Array<{ id: string; email: string; roleId: string }>;
  roles: Array<{ id: string; name: string }>;
}
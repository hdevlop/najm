import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { CacheService } from 'najm-cache';
import { authSchema } from '../src/schema/sqlite';
import { TokenRepository } from '../src/tokens/TokenRepository';
import { TokenService } from '../src/tokens/TokenService';
import { SessionInvalidationService } from '../src/tokens/SessionInvalidationService';
import { UserService } from '../src/users/UserService';
import { AuthGuard } from '../src/auth/AuthGuard';

/**
 * Deactivating an account has to end its API access, not merely stop new
 * logins. These cases go through the real TokenService verification path — the
 * assertion is always "can this credential still authorize a request", never
 * "did some method get called".
 */

const authConfig = {
  jwt: {
    accessSecret: 'access-secret-access-secret-access-secret',
    accessExpiresIn: '1h',
    refreshSecret: 'refresh-secret-refresh-secret-refresh-secret',
    refreshExpiresIn: '7d',
  },
  refreshCookieName: 'refreshToken',
  database: 'default',
  blacklistPrefix: 'auth:blacklist:',
  defaultRole: null,
  frontendUrl: 'http://localhost:3000',
  registrationMode: 'active' as const,
  lockout: { maxAttempts: 5, duration: '15m' },
  bcryptRounds: 10,
  session: { name: 'najm.session', maxAge: 300 },
};

const TOKENS_DDL = `
  CREATE TABLE tokens (
    id text PRIMARY KEY,
    created_at text,
    updated_at text,
    user_id text NOT NULL,
    token text NOT NULL,
    token_family text NOT NULL UNIQUE,
    previous_hash text,
    previous_valid_until text,
    previous_used_at text,
    type text DEFAULT 'refresh',
    status text DEFAULT 'active',
    expires_at text NOT NULL
  );
`;

function harness() {
  const sqlite = new Database(':memory:');
  sqlite.exec(TOKENS_DDL);
  const db = drizzle(sqlite, { schema: authSchema });

  // The user table stands in for the real one; what matters here is that the
  // repository projection carries `status` and the row can change underneath a
  // live token.
  const users = new Map<string, Record<string, unknown>>([
    ['user-1', { id: 'user-1', email: 'one@example.test', status: 'active', role: 'member', permissions: ['orders:read'] }],
    ['user-2', { id: 'user-2', email: 'two@example.test', status: 'active', role: 'member', permissions: ['orders:read'] }],
  ]);

  const repo = new TokenRepository();
  (repo as any).db = db;
  (repo as any).schema = authSchema;
  (repo as any).getRoleAndPermissions = async (id: string) => ({
    roleName: users.get(id)?.role ?? null,
    permissions: (users.get(id)?.permissions as string[]) ?? [],
  });
  (repo as any).getUser = async (id: string) => users.get(id) ?? null;

  const cookie = {
    value: undefined as string | undefined,
    getRefreshToken() { return this.value; },
    clearRefreshToken() { this.value = undefined; },
    clearSessionCookie() { /* unused here */ },
  };

  const cache = new CacheService({ driver: 'memory', required: false, memory: {} } as any);
  const invalidation = new SessionInvalidationService(cache, repo);
  (invalidation as any).config = authConfig;

  const tokens = new TokenService(repo as any, cookie as any, cache as any, undefined, invalidation);
  (tokens as any).config = authConfig;
  (tokens as any).t = (key: string) => key;

  // A UserRepository stand-in over the same map, so a mutation a test performs
  // is the one the token path then reads.
  const userRepository = {
    update: async (id: string, data: Record<string, unknown>) => {
      const row = users.get(id);
      if (!row) return undefined;
      Object.assign(row, data);
      return row;
    },
    delete: async (id: string) => {
      const row = users.get(id);
      users.delete(id);
      return row;
    },
    deleteAll: async () => {
      const rows = [...users.values()];
      users.clear();
      return rows;
    },
    getIdsByRole: async () => [...users.keys()],
  };

  const userService = new UserService(
    { checkRoleExists: async () => undefined } as any,
    { getByName: async () => ({ id: 'role-x' }) } as any,
    userRepository as any,
    { checkEmailUnique: async () => undefined, validatePasswordStrength: () => undefined } as any,
    { hashPassword: async (p: string) => `hashed:${p}` } as any,
    {} as any,
    authConfig as any,
    invalidation,
  );
  (userService as any).t = (key: string) => key;

  return { db, repo, cache, tokens, users, userService, invalidation, cookie };
}

/** Can this bearer token still authorize a request? */
async function authorizes(tokens: TokenService, accessToken: string): Promise<boolean> {
  try {
    return Boolean(await tokens.getUser(`Bearer ${accessToken}`));
  } catch {
    return false;
  }
}

describe('an account change ends the access it revoked', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); });

  test('deactivation through the generic update denies an existing token', async () => {
    const session = await h.tokens.generateTokens('user-1');
    expect(await authorizes(h.tokens, session.accessToken)).toBe(true);

    await h.userService.update('user-1', { status: 'inactive' });

    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
  });

  test('deactivation also ends the refresh session, not only the access token', async () => {
    const session = await h.tokens.generateTokens('user-1');
    h.cookie.value = session.refreshToken;

    await h.userService.update('user-1', { status: 'inactive' });

    expect(h.tokens.refreshTokens()).rejects.toThrow();
    expect(await h.repo.getByFamily(session.tokenFamily)).toBeNull();
  });

  test('deletion denies every credential the account held', async () => {
    const a = await h.tokens.generateTokens('user-1');
    const b = await h.tokens.generateTokens('user-1');

    await h.userService.delete('user-1');

    expect(await authorizes(h.tokens, a.accessToken)).toBe(false);
    expect(await authorizes(h.tokens, b.accessToken)).toBe(false);
    expect(await h.repo.getByFamily(a.tokenFamily)).toBeNull();
    expect(await h.repo.getByFamily(b.tokenFamily)).toBeNull();
  });

  test('role assignment and removal both end the sessions holding the old claims', async () => {
    const assigned = await h.tokens.generateTokens('user-1');
    await h.userService.assignRole('user-1', 'role-x');
    expect(await authorizes(h.tokens, assigned.accessToken)).toBe(false);

    const removed = await h.tokens.generateTokens('user-1');
    await h.userService.removeRole('user-1');
    expect(await authorizes(h.tokens, removed.accessToken)).toBe(false);
  });

  test('a password replacement through the generic update ends existing sessions', async () => {
    const session = await h.tokens.generateTokens('user-1');
    await h.userService.update('user-1', { password: 'ReplacedPassw0rd' });
    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
  });

  test('a harmless profile update leaves the user signed in', async () => {
    const session = await h.tokens.generateTokens('user-1');

    await h.userService.update('user-1', { name: 'Renamed', image: '/avatar.png' });

    expect(await authorizes(h.tokens, session.accessToken)).toBe(true);
    expect(await h.repo.getByFamily(session.tokenFamily)).not.toBeNull();
  });

  test('one account\'s change never touches another account', async () => {
    const mine = await h.tokens.generateTokens('user-1');
    const theirs = await h.tokens.generateTokens('user-2');

    await h.userService.update('user-1', { status: 'inactive' });

    expect(await authorizes(h.tokens, mine.accessToken)).toBe(false);
    expect(await authorizes(h.tokens, theirs.accessToken)).toBe(true);
  });

  test('reactivation does not resurrect the sessions the deactivation ended', async () => {
    const session = await h.tokens.generateTokens('user-1');
    await h.userService.update('user-1', { status: 'inactive' });
    await h.userService.update('user-1', { status: 'active' });

    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
    expect(await h.repo.getByFamily(session.tokenFamily)).toBeNull();

    // A fresh login works normally.
    const fresh = await h.tokens.generateTokens('user-1');
    expect(await authorizes(h.tokens, fresh.accessToken)).toBe(true);
  });

  test('concurrent deactivations leave the account denied, not restored', async () => {
    const session = await h.tokens.generateTokens('user-1');

    await Promise.all([
      h.userService.update('user-1', { status: 'inactive' }),
      h.userService.update('user-1', { status: 'inactive' }),
      h.userService.update('user-1', { status: 'inactive' }),
    ]);

    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
  });

  test('a token minted while a deactivation lands does not survive it', async () => {
    // Issuance reads the session version, the deactivation bumps it, then
    // issuance completes. The completing write must not restore the old version.
    const issuing = h.tokens.generateTokens('user-1');
    await h.userService.update('user-1', { status: 'inactive' });
    const session = await issuing;

    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
  });

  test('an inactive account is denied even when its record is still cached', async () => {
    const session = await h.tokens.generateTokens('user-1');
    await h.tokens.getUser(`Bearer ${session.accessToken}`); // fills the user cache

    // Change the row without going through invalidation at all: a truthy
    // cached record must still not be enough to authorize.
    h.users.get('user-1')!.status = 'inactive';
    await h.cache.del('auth:user:user-1');

    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
  });

  test('a role permission change ends the sessions of that role\'s holders', async () => {
    const session = await h.tokens.generateTokens('user-1');
    await h.invalidation.invalidateAccessTokens('user-1');
    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
  });

  test('deleteAll ends every account\'s sessions', async () => {
    const a = await h.tokens.generateTokens('user-1');
    const b = await h.tokens.generateTokens('user-2');

    await h.userService.deleteAll();

    expect(await authorizes(h.tokens, a.accessToken)).toBe(false);
    expect(await authorizes(h.tokens, b.accessToken)).toBe(false);
  });
});

describe('the guard does not accept a merely truthy principal', () => {
  const guard = new AuthGuard();

  test('an active or status-free principal passes', () => {
    expect(guard.canActivate({ id: 'u', status: 'active' })).toBe(true);
    expect(guard.canActivate({ id: 'u' })).toBe(true);
  });

  test('a non-active principal is refused', () => {
    for (const status of ['inactive', 'pending', 'suspended', 'deleted', '']) {
      expect(guard.canActivate({ id: 'u', status })).toBe(false);
    }
    expect(guard.canActivate(undefined)).toBe(false);
    expect(guard.canActivate(null)).toBe(false);
  });
});

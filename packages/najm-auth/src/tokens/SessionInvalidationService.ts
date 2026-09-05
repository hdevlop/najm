import { Inject, Injectable } from 'najm-core';
import { CacheService } from 'najm-cache';
import timestring from 'timestring';
import { AUTH_CONFIG } from '../auth.tokens';
import type { AuthConfig } from '../types';
import { TokenRepository } from './TokenRepository';

/**
 * The single owner of "this credential is no longer good".
 *
 * Every path that changes a user's security state — status, password, role,
 * permissions, deletion — has to reach the same code, or one of them will be
 * forgotten and an already-issued token will outlive the change that was
 * supposed to end it. That is the shape of the defect this service closes.
 *
 * It deliberately depends on the repository rather than TokenService: TokenService
 * needs to call it too, and going through the service would close a DI cycle.
 */
@Injectable()
export class SessionInvalidationService {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;

  constructor(
    private cache: CacheService,
    private tokens: TokenRepository,
  ) { }

  /**
   * Fields whose change ends existing sessions. Everything absent from this set
   * — display name, avatar, language — is a profile edit and must leave the
   * user signed in, on every device.
   */
  static readonly SECURITY_FIELDS = Object.freeze([
    'password',
    'status',
    'role',
    'roleId',
    'email',
    'emailVerified',
    'phone',
  ] as const);

  /** Whether an update payload touches anything that must end sessions. */
  static affectsSecurityState(data: Record<string, unknown> | null | undefined): boolean {
    if (!data) return false;
    return SessionInvalidationService.SECURITY_FIELDS.some(
      (field) => data[field] !== undefined,
    );
  }

  private get accessTokenTtlMs(): number {
    return timestring(this.config.jwt.accessExpiresIn, 'ms');
  }

  private get refreshTokenTtlMs(): number {
    return timestring(this.config.jwt.refreshExpiresIn, 'ms');
  }

  sessionVersionKey(userId: string): string {
    return `auth:session-version:${userId}`;
  }

  revokedFamilyKey(tokenFamily: string): string {
    return `auth:revoked-family:${tokenFamily}`;
  }

  /**
   * Positive liveness marker for one session family.
   *
   * The signed session snapshot is authorized against this rather than against
   * the absence of a revocation marker, so losing the cache cannot make a
   * logged-out family look valid again: with no marker the fast path simply
   * declines and the request falls through to the database-backed resolver.
   */
  familyKey(tokenFamily: string): string {
    return `auth:family:${tokenFamily}`;
  }

  userCacheKey(userId: string): string {
    return `auth:user:${userId}`;
  }

  parseSessionVersion(raw: string | null): number {
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  async getSessionVersion(userId: string): Promise<number> {
    return this.parseSessionVersion(await this.cache.get(this.sessionVersionKey(userId)));
  }

  /**
   * Extend the version key's lifetime without rewriting its value.
   *
   * Token issuance used to `set()` the version it had just read, which meant an
   * invalidation landing between that read and that write was silently undone —
   * the revoked version came back and the old tokens verified again. Only the
   * expiry is touched here, so a concurrent bump always survives.
   */
  async touchSessionVersion(userId: string): Promise<void> {
    await this.cache.expire(this.sessionVersionKey(userId), this.accessTokenTtlMs);
  }

  /**
   * Invalidate every access token already issued for a user, and drop the
   * cached user record so the next read sees the new state rather than a stale
   * snapshot that is merely truthy.
   *
   * The bump is an atomic increment, so concurrent invalidations cannot read
   * the same version and write the same successor back.
   */
  async invalidateAccessTokens(userId: string): Promise<number> {
    const key = this.sessionVersionKey(userId);
    const { count } = await this.cache.incr(key, this.accessTokenTtlMs);
    // incr only attaches a TTL when it creates the key; extend it so a series
    // of invalidations cannot leave the marker expiring on the first one's clock.
    await this.cache.expire(key, this.accessTokenTtlMs);
    await this.dropUserCache(userId);
    return count;
  }

  async dropUserCache(userId: string): Promise<void> {
    await this.cache.del(this.userCacheKey(userId));
  }

  /**
   * End every session a user holds: access tokens by version, refresh sessions
   * by row, and each family's liveness marker.
   *
   * Callers run this AFTER their database mutation has committed. Running it
   * before would leave a window in which a concurrent login re-established a
   * session against the state the mutation was about to remove; running it
   * after a rollback merely signs the user out again, which is safe.
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.invalidateAccessTokens(userId);
    // The durable update reports the rows it revoked, so the families come
    // from the operation itself rather than a second read that could race.
    const revoked = await this.tokens.revokeAllForUser(userId);
    await Promise.all(
      familiesOf(revoked).map((family) => this.markFamilyRevoked(family)),
    );
  }

  /**
   * Record that a family is live, and whose it is. Called wherever the family's
   * refresh row is written.
   *
   * The marker stores the owning user rather than a bare flag so a reader can
   * confirm, in the same single lookup, that the family it was handed actually
   * belongs to the identity claiming it.
   *
   * Revocation always wins. A refresh that rotated its row, was descheduled,
   * and resumed after a logout would otherwise re-mark its family live and
   * hand the browser back the session it had just ended — the database row is
   * gone by then, but nothing on the fast path reads the database. So this
   * writes, then re-reads the revocation marker and withdraws the write if one
   * appeared. Combined with `markFamilyRevoked` setting the revocation marker
   * *before* clearing liveness, every interleaving of the two converges on
   * revoked: whichever of the pair observes the other, the liveness key ends
   * up deleted.
   *
   * @returns whether the family is live after this call.
   */
  async markFamilyIssued(tokenFamily: string, userId: string): Promise<boolean> {
    await this.cache.set(this.familyKey(tokenFamily), userId, this.refreshTokenTtlMs);

    if (await this.isFamilyRevoked(tokenFamily)) {
      await this.cache.del(this.familyKey(tokenFamily));
      return false;
    }
    return true;
  }

  /**
   * What one lookup can say about a family, in a single batched cache read.
   *
   * The three answers are deliberately distinct. `revoked` is authoritative and
   * must deny. `unknown` means the cache cannot vouch for the family — it was
   * evicted, or the cache was lost — and must send the caller to an
   * authoritative, database-backed check rather than being read either way.
   * Only `live` is a positive assertion, and only for the named user.
   */
  async familyStatus(
    tokenFamily: string | undefined,
    userId?: string,
  ): Promise<'live' | 'revoked' | 'unknown'> {
    if (!tokenFamily) return 'unknown';

    const [owner, revoked] = await this.readMany([
      this.familyKey(tokenFamily),
      this.revokedFamilyKey(tokenFamily),
    ]);

    if (revoked != null) return 'revoked';
    if (owner == null) return 'unknown';
    if (userId !== undefined && owner !== userId) return 'revoked';
    return 'live';
  }

  /**
   * Whether a family is positively known to be live, and — when a user is
   * given — to belong to that user.
   *
   * `false` means "not proven live" — revoked, mismatched, or simply not in
   * cache. Callers must treat it as a reason to fall back to an authoritative
   * check, never as proof of validity in the other direction.
   */
  async isFamilyLive(tokenFamily: string, userId?: string): Promise<boolean> {
    return (await this.familyStatus(tokenFamily, userId)) === 'live';
  }

  private async readMany(keys: string[]): Promise<Array<string | null>> {
    const cache = this.cache as CacheService & {
      getMany?: (keys: string[]) => Promise<Array<string | null>>;
    };
    if (cache.getMany) return cache.getMany(keys);
    return Promise.all(keys.map((key) => cache.get(key)));
  }

  /**
   * Keep revocation through both credential lifetimes. If deleting the refresh
   * row fails, its still-valid cookie must remain denied after access expires.
   */
  async markFamilyRevoked(tokenFamily: string): Promise<void> {
    await this.cache.set(
      this.revokedFamilyKey(tokenFamily),
      '1',
      Math.max(this.accessTokenTtlMs, this.refreshTokenTtlMs),
    );
    await this.cache.del(this.familyKey(tokenFamily));
  }

  async isFamilyRevoked(tokenFamily: string): Promise<boolean> {
    return (await this.cache.get(this.revokedFamilyKey(tokenFamily))) !== null;
  }

}

/** Token families named by a revoke result, tolerating drivers that return none. */
function familiesOf(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => (row as { tokenFamily?: unknown })?.tokenFamily)
    .filter((family): family is string => typeof family === 'string' && family.length > 0);
}

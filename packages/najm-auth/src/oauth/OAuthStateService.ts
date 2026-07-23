import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from 'najm-core';
import { CookieService } from 'najm-cookies';
import { EncryptionService } from '../auth/EncryptionService';
import type { OAuthAttempt, OAuthIntent } from './types';
import { OAuthFlowError } from './types';

const ATTEMPT_TTL_MS = 10 * 60 * 1000;
const COOKIE_PREFIX = 'najm.oauth.google.';

@Injectable()
export class OAuthStateService {
  constructor(
    private cookies: CookieService,
    private encryption: EncryptionService,
  ) { }

  create(input: {
    intent: OAuthIntent;
    returnTo?: string;
    userId?: string;
    sessionVersion?: number;
  }): { attempt: OAuthAttempt; codeChallenge: string } {
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(48).toString('base64url');
    const attempt: OAuthAttempt = {
      provider: 'google',
      intent: input.intent,
      state,
      nonce: randomBytes(32).toString('base64url'),
      codeVerifier,
      returnTo: this.validateReturnTo(input.returnTo),
      userId: input.userId,
      sessionVersion: input.sessionVersion,
      createdAt: Date.now(),
    };

    this.cookies.set(this.cookieName(state), this.encryption.encrypt(JSON.stringify(attempt)), {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: Math.floor(ATTEMPT_TTL_MS / 1000),
    });

    return {
      attempt,
      codeChallenge: createHash('sha256').update(codeVerifier).digest('base64url'),
    };
  }

  consume(state: string): OAuthAttempt {
    if (!this.isSafeState(state)) throw new OAuthFlowError('oauth_state_invalid');

    const name = this.cookieName(state);
    const encrypted = this.cookies.get(name);
    this.cookies.delete(name, { path: '/' });
    if (!encrypted) throw new OAuthFlowError('oauth_state_invalid');

    try {
      const attempt = JSON.parse(this.encryption.decrypt(encrypted)) as OAuthAttempt;
      const expected = Buffer.from(attempt.state);
      const actual = Buffer.from(state);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        throw new OAuthFlowError('oauth_state_invalid');
      }
      if (attempt.provider !== 'google' || Date.now() - attempt.createdAt > ATTEMPT_TTL_MS) {
        throw new OAuthFlowError('oauth_state_invalid');
      }
      attempt.returnTo = this.validateReturnTo(attempt.returnTo);
      return attempt;
    } catch (error) {
      if (error instanceof OAuthFlowError) throw error;
      throw new OAuthFlowError('oauth_state_invalid');
    }
  }

  validateReturnTo(value?: string): string {
    const candidate = value?.trim() || '/';
    if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
      throw new OAuthFlowError('oauth_redirect_invalid');
    }

    try {
      const base = new URL('https://najm.invalid');
      const parsed = new URL(candidate, base);
      if (parsed.origin !== base.origin || parsed.username || parsed.password) {
        throw new OAuthFlowError('oauth_redirect_invalid');
      }
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch (error) {
      if (error instanceof OAuthFlowError) throw error;
      throw new OAuthFlowError('oauth_redirect_invalid');
    }
  }

  private cookieName(state: string): string {
    return `${COOKIE_PREFIX}${state}`;
  }

  private isSafeState(state: string): boolean {
    return /^[A-Za-z0-9_-]{40,128}$/.test(state);
  }
}

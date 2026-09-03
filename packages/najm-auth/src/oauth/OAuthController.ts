import { createHash } from 'node:crypto';
import { Controller, Ctx, Get, Post, Query, User } from 'najm-core';
import type { Context } from 'hono';
import { RateLimit, type RateLimitKeyContext } from 'najm-rate';
import { isAuth } from '../auth/AuthGuard';
import { OAuthService } from './OAuthService';

const callbackKey = (ctx: Context, { clientIp }: RateLimitKeyContext): string => {
  const ip = clientIp;
  const state = ctx.req.query('state') ?? 'none';
  const fingerprint = createHash('sha256').update(state).digest('base64url').slice(0, 24);
  return `${ip}:${fingerprint}`;
};

@Controller('/auth/oauth/google')
export class OAuthController {
  constructor(private oauth: OAuthService) { }

  @Get('/start')
  @RateLimit({ limit: 20, window: '15m', key: 'ip' })
  start(@Ctx() ctx: Context, @Query('returnTo') returnTo?: string) {
    return ctx.redirect(this.oauth.startGoogleLogin(returnTo), 302);
  }

  @Get('/callback')
  @RateLimit({ limit: 20, window: '15m', key: callbackKey })
  async callback(
    @Ctx() ctx: Context,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const redirect = await this.oauth.finishGoogleCallback({ code, state, error });
    return ctx.redirect(redirect, 302);
  }

  @Post('/link')
  @isAuth()
  @RateLimit({ limit: 10, window: '15m', key: 'user' })
  link(@User('id') userId: string, @Query('returnTo') returnTo?: string) {
    return this.oauth.startGoogleLink(userId, returnTo);
  }
}

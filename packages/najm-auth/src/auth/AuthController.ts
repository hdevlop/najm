import { Controller, Err } from 'najm-core';
import { Get, Post, ResMsg } from 'najm-core';
import { Params, Body, User, Headers, Ctx } from 'najm-core';
import { AuthService } from './AuthService';
import { isAuth } from './AuthGuard';
import { isAdmin } from '../roles/RoleGuards';
import { Validate } from 'najm-validation';
import { RateLimit, UNRESOLVED_CLIENT_ADDRESS, type RateLimitKeyContext } from 'najm-rate';
import type { Context } from 'hono';
import { createHash } from 'node:crypto';
import { getRequestIdentityResolver } from '../identity/requestResolver';
import { resolveAuthLoginRateLimitConfig } from './authLoginRateLimitConfig';
import {
  inviteUserDto,
  loginDto,
  userIdParam,
  changePasswordDto,
  resetPasswordDto,
  confirmResetPasswordDto,
  type InviteUserDto,
  type ChangePasswordDto,
  type LoginDto,
  type UserIdParam,
  type ResetPasswordDto,
  type ConfirmResetPasswordDto
} from '../users/UserDto';

const hashKeyPart = (value: string): string =>
  createHash('sha256').update(value).digest('base64url').slice(0, 32);

const cookieFingerprint = () => (ctx: Context, { clientIp }: RateLimitKeyContext): string => {
  const cookie = ctx.req.raw.headers.get('cookie') ?? '';
  const fingerprint = cookie ? hashKeyPart(cookie) : 'none';
  return `${clientIp}:${fingerprint}`;
};

/**
 * Composite key: resolved client address + hashed normalized identity.
 * Buckets rate limits per client+credential combo so different users
 * on the same address (e.g. localhost, NAT) don't share a single bucket.
 *
 * The address arrives already resolved through the configured trusted-proxy
 * boundary; this module must never parse forwarding headers itself.
 */
export const authIdentityRateLimitKey = async (
  ctx: Context,
  keyContext?: RateLimitKeyContext,
): Promise<string> => {
  // najm-rate always supplies the resolved address. The parameter stays
  // optional so a direct caller from an older integration still compiles, and
  // such a call fails closed into the shared unresolved bucket rather than
  // silently reaching for a spoofable header.
  const ip = keyContext?.clientIp ?? UNRESOLVED_CLIENT_ADDRESS;
  try {
    const body = await ctx.req.json();
    const identity = body?.identifier ?? body?.email;
    const normalizedIdentity = getRequestIdentityResolver(ctx)(identity);
    if (normalizedIdentity) {
      return `${ip}:${hashKeyPart(normalizedIdentity)}`;
    }
  } catch {
    // Body not available or not JSON — fall back to IP only
  }
  return ip;
};

const loginRateLimit = resolveAuthLoginRateLimitConfig();

@Controller('/auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('/login')
  @RateLimit({
    limit: loginRateLimit.limit,
    window: loginRateLimit.window,
    key: authIdentityRateLimitKey,
    message: 'Too many login attempts. Please try again later.',
    skip: !loginRateLimit.enabled,
  })
  @Validate(loginDto)
  @ResMsg('auth.success.login')
  async loginUser(@Body() body: LoginDto) {
    return this.authService.loginUser(body);
  }

  @Post('/invite')
  @isAdmin()
  @RateLimit({ limit: 20, window: '15m', key: 'user' })
  @Validate(inviteUserDto)
  @ResMsg('auth.success.accountInviteSent')
  async inviteUser(@Body() body: InviteUserDto) {
    return this.authService.inviteUser(body);
  }

  @Post('/refresh')
  @RateLimit({ limit: 15, window: '15m', key: cookieFingerprint() })
  @ResMsg('auth.success.tokenRefreshed')
  async refreshTokens() {
    return this.authService.refreshTokens();
  }

  @Post('/session/recover')
  @RateLimit({ limit: 120, window: '1m', key: cookieFingerprint() })
  @ResMsg('auth.success.sessionRecovered')
  async recoverSession(
    @Headers('x-najm-session-recovery') recoveryRequest: string | undefined,
    @Ctx() ctx: Context,
  ) {
    if (recoveryRequest !== '1') {
      Err('Invalid session recovery request', 400);
    }
    ctx.header('Cache-Control', 'private, no-store');
    ctx.header('Vary', 'Cookie');
    return this.authService.recoverSession();
  }

  @Post('/logout')
  async logoutUser(
    @User('id') userId: string | undefined,
    @Headers('authorization') authorization?: string
  ) {
    return this.authService.logoutUser(userId, authorization);
  }

  @Post('/change-password')
  @isAuth()
  @Validate(changePasswordDto)
  @ResMsg('auth.success.passwordChanged')
  async changePassword(
    @User('id') userId: string,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, body.currentPassword, body.newPassword);
  }

  @Get('/me')
  @RateLimit({ limit: 30, window: '1m', key: cookieFingerprint() })
  @ResMsg('auth.users.success.retrieved')
  async userProfile(@Headers('authorization') authorization?: string) {
    return this.authService.getMe(authorization);
  }

  @Post('/forgot-password')
  @RateLimit({ limit: 3, window: '15m', key: authIdentityRateLimitKey, message: 'Too many password reset requests. Please try again later.' })
  @Validate(resetPasswordDto)
  @ResMsg('auth.success.passwordResetSent')
  async forgotPassword(@Body() body: ResetPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('/reset-password')
  @RateLimit({ limit: 5, window: '15m', key: 'ip', message: 'Too many password reset attempts. Please try again later.' })
  @Validate(confirmResetPasswordDto)
  @ResMsg('auth.success.passwordReset')
  async resetPassword(@Body() body: ConfirmResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }
}

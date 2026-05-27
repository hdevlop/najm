import { Controller } from 'najm-core';
import { Get, Post, ResMsg } from 'najm-core';
import { Params, Body, User, Headers } from 'najm-core';
import { AuthService } from './AuthService';
import { isAuth } from './AuthGuard';
import { Validate } from 'najm-validation';
import { RateLimit } from 'najm-rate';
import type { Context } from 'hono';
import {
  createUserDto,
  loginDto,
  userIdParam,
  changePasswordDto,
  resetPasswordDto,
  confirmResetPasswordDto,
  type CreateUserDto,
  type ChangePasswordDto,
  type LoginDto,
  type UserIdParam,
  type ResetPasswordDto,
  type ConfirmResetPasswordDto
} from '../users/UserDto';

let _configuredCookieName = 'refreshToken';

export const setConfiguredCookieName = (name: string) => {
  _configuredCookieName = name;
};

const cookieFingerprint = (cookieName?: string) => (ctx: Context): string => {
  const name = cookieName ?? _configuredCookieName;
  const ip = ctx.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    ?? ctx.req.header('x-real-ip')
    ?? 'unknown';
  const cookie = ctx.req.raw.headers.get('cookie');
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cookie?.match(new RegExp(`${escaped}=([^;]+)`));
  const fingerprint = match?.[1]?.slice(-8) ?? 'none';
  return `${ip}:${fingerprint}`;
};

/**
 * Composite key: IP + request body email field.
 * Buckets rate limits per IP+credential combo so different users
 * on the same IP (e.g. localhost, NAT) don't share a single bucket.
 */
const ipAndEmail = async (ctx: Context): Promise<string> => {
  const ip = ctx.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    ?? ctx.req.header('x-real-ip')
    ?? 'unknown';
  try {
    const body = await ctx.req.json();
    if (body?.email) return `${ip}:${body.email}`;
  } catch {
    // Body not available or not JSON — fall back to IP only
  }
  return ip;
};

@Controller('/auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('/register')
  @RateLimit({ limit: 5, window: '15m', key: ipAndEmail })
  @Validate(createUserDto)
  @ResMsg('auth.success.register')
  async registerUser(@Body() body: CreateUserDto) {
    return this.authService.registerUser(body);
  }

  @Post('/login')
  @RateLimit({ limit: 5, window: '15m', key: ipAndEmail, message: 'Too many login attempts. Please try again later.' })
  @Validate(loginDto)
  @ResMsg('auth.success.login')
  async loginUser(@Body() body: LoginDto) {
    return this.authService.loginUser(body);
  }

  @Post('/refresh')
  @RateLimit({ limit: 15, window: '15m', key: cookieFingerprint() })
  @ResMsg('auth.success.tokenRefreshed')
  async refreshTokens() {
    return this.authService.refreshTokens();
  }

  @Post('/logout')
  @isAuth()
  @RateLimit({ limit: 10, window: '15m', key: 'user' })
  async logoutUser(
    @User('id') userId: string,
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
  @RateLimit({ limit: 3, window: '15m', key: ipAndEmail, message: 'Too many password reset requests. Please try again later.' })
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

import { Controller, Post, Body, Ctx, Inject, LoggerService, User } from 'najm-core';
import { isAuth, UserRepository } from 'najm-auth';
import { Validate } from 'najm-validation';
import { RateLimit } from 'najm-rate';
import type { Context } from 'hono';
import { z } from 'zod';
import { PhoneLinkService } from './PhoneLinkService';

const linkPhoneDto = z.object({
  phone: z.string().min(6).max(20).regex(/^\+?[0-9]+$/, 'Phone must be digits, optional leading +'),
});

const verifyPhoneDto = z.object({
  phone: z.string().min(6).max(20).regex(/^\+?[0-9]+$/),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

type LinkPhoneDto = z.infer<typeof linkPhoneDto>;
type VerifyPhoneDto = z.infer<typeof verifyPhoneDto>;

const ipAndPhone = async (ctx: Context): Promise<string> => {
  const body = await ctx.req.json().catch(() => ({} as any));
  const ip = ctx.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    ?? ctx.req.header('x-real-ip')
    ?? 'unknown';
  return `${ip}:${body?.phone ?? 'unknown'}`;
};

@Controller('/auth')
export class PhoneLinkController {
  @Inject(PhoneLinkService) private phoneLink!: PhoneLinkService;
  @Inject(UserRepository) private users!: UserRepository;
  @Inject(LoggerService) private log!: LoggerService;

  @Post('/link-phone')
  @isAuth()
  @RateLimit({ limit: 3, window: '15m', key: ipAndPhone, message: 'Too many OTP requests. Try again later.' })
  @Validate(linkPhoneDto)
  async linkPhone(@Body() body: LinkPhoneDto, @Ctx() ctx: Context) {
    const result = await this.phoneLink.sendOtp(body.phone);
    if (!result.success) {
      return ctx.json({ ok: false, error: result.error }, 400);
    }
    return ctx.json({ ok: true });
  }

  @Post('/verify-phone')
  @isAuth()
  @RateLimit({ limit: 5, window: '15m', key: ipAndPhone, message: 'Too many verification attempts.' })
  @Validate(verifyPhoneDto)
  async verifyPhone(
    @Body() body: VerifyPhoneDto,
    @User('id') userId: string,
    @Ctx() ctx: Context,
  ) {
    const result = await this.phoneLink.verifyOtp(body.phone, body.otp);
    if (!result.valid) {
      return ctx.json({ ok: false, error: result.error }, 400);
    }

    try {
      await this.users.updatePhone(userId, body.phone);
      return ctx.json({ ok: true, phoneVerified: true });
    } catch (err: any) {
      this.log.error(`Failed to persist phone link for user ${userId}: ${err?.message ?? err}`);
      return ctx.json({ ok: false, error: 'Failed to save phone number.' }, 500);
    }
  }
}

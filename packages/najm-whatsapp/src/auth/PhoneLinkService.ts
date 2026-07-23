import { Service, Meta, Inject, LoggerService } from 'najm-core';
import { CacheService } from 'najm-cache';
import { WHATSAPP_CONFIG } from '../tokens';
import { WhatsAppService } from '../WhatsAppService';
import type { WhatsAppConfig } from '../types';
import { randomInt, timingSafeEqual } from 'crypto';

const OTP_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

@Service()
@Meta({ layer: 'plugin' })
export class PhoneLinkService {
  @Inject(WHATSAPP_CONFIG) private config!: WhatsAppConfig;
  @Inject(LoggerService) private log!: LoggerService;
  @Inject(CacheService) private cache!: CacheService;
  @Inject(WhatsAppService) private wa!: WhatsAppService;

  async sendOtp(phone: string): Promise<{ success: boolean; error?: string }> {
    const rateKey = `wa:otp:rate:${phone}`;
    const { count } = await this.cache.incr(rateKey, RATE_LIMIT_WINDOW_MS);

    if (count > RATE_LIMIT_MAX) {
      return { success: false, error: 'Too many OTP requests. Try again later.' };
    }

    const otp = String(randomInt(100000, 999999));
    const otpKey = `wa:otp:${phone}`;

    await this.cache.set(otpKey, otp, OTP_TTL_MS);

    const templateName = this.config.otpTemplate ?? 'auth_otp';
    const templateLang = this.config.otpTemplateLang ?? 'en';

    try {
      await this.wa.sendTemplate(phone, templateName, templateLang, [
        { type: 'text', text: otp },
      ]);
      this.log.info(`OTP sent to ${phone}`);
      return { success: true };
    } catch (err: any) {
      this.log.error(`Failed to send OTP to ${phone}: ${err.message}`);
      return { success: false, error: 'Failed to send OTP via WhatsApp.' };
    }
  }

  async verifyOtp(phone: string, otp: string): Promise<{ valid: boolean; error?: string }> {
    const otpKey = `wa:otp:${phone}`;
    const stored = await this.cache.get(otpKey);

    if (!stored) {
      return { valid: false, error: 'OTP expired or not found.' };
    }

    // Constant-time comparison with equal-length buffers prevents timing
    // attacks against the OTP comparison. We pad both sides to the OTP
    // length so different-length inputs always return false without
    // short-circuiting.
    const expected = stored;
    const provided = otp ?? '';
    if (expected.length !== provided.length) {
      return { valid: false, error: 'Invalid OTP.' };
    }
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (!timingSafeEqual(a, b)) {
      return { valid: false, error: 'Invalid OTP.' };
    }

    await this.cache.del(otpKey);
    return { valid: true };
  }
}

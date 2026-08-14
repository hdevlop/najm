import type { TimeWindow } from 'najm-rate';

export const AUTH_LOGIN_RATE_LIMIT_ENV = {
  enabled: 'NAJM_AUTH_LOGIN_RATE_LIMIT_ENABLED',
  limit: 'NAJM_AUTH_LOGIN_RATE_LIMIT',
  window: 'NAJM_AUTH_LOGIN_RATE_WINDOW',
} as const;

export interface AuthLoginRateLimitConfig {
  enabled: boolean;
  limit: number;
  window: TimeWindow;
}

export type AuthRateLimitEnvironment = Record<string, string | undefined>;

export const DEFAULT_AUTH_LOGIN_RATE_LIMIT = {
  enabled: true,
  limit: 8,
  window: '10m',
} as const satisfies AuthLoginRateLimitConfig;

function parseEnabled(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_AUTH_LOGIN_RATE_LIMIT.enabled;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  throw new Error(`${AUTH_LOGIN_RATE_LIMIT_ENV.enabled} must be true or false`);
}

function parseLimit(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_AUTH_LOGIN_RATE_LIMIT.limit;
  }

  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${AUTH_LOGIN_RATE_LIMIT_ENV.limit} must be a positive safe integer`);
  }

  const limit = Number(normalized);
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error(`${AUTH_LOGIN_RATE_LIMIT_ENV.limit} must be a positive safe integer`);
  }

  return limit;
}

function parseWindow(raw: string | undefined): TimeWindow {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_AUTH_LOGIN_RATE_LIMIT.window;
  }

  const normalized = raw.trim().toLowerCase();
  const match = normalized.match(/^([1-9]\d*)(s|m|h|d)$/);
  if (!match) {
    throw new Error(
      `${AUTH_LOGIN_RATE_LIMIT_ENV.window} must be a positive duration such as 30s, 10m, 1h, or 1d`,
    );
  }

  const amount = Number(match[1]);
  const multiplier = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  }[match[2] as 's' | 'm' | 'h' | 'd'];

  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(amount * multiplier)) {
    throw new Error(`${AUTH_LOGIN_RATE_LIMIT_ENV.window} is too large`);
  }

  return normalized as TimeWindow;
}

export function resolveAuthLoginRateLimitConfig(
  env: AuthRateLimitEnvironment = process.env,
): AuthLoginRateLimitConfig {
  return {
    enabled: parseEnabled(env[AUTH_LOGIN_RATE_LIMIT_ENV.enabled]),
    limit: parseLimit(env[AUTH_LOGIN_RATE_LIMIT_ENV.limit]),
    window: parseWindow(env[AUTH_LOGIN_RATE_LIMIT_ENV.window]),
  };
}

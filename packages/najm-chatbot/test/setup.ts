import '../../../scripts/bun-test-legacy-decorators';

process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER ?? 'memory';
process.env.NAJM_AUTH_LOGIN_RATE_LIMIT_ENABLED =
  process.env.NAJM_AUTH_LOGIN_RATE_LIMIT_ENABLED ?? 'false';

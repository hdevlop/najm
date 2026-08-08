import { Body, Controller, Get, Post, ResMsg } from 'najm-core';
import { RateLimit } from 'najm-rate';
import { Validate } from 'najm-validation';
import { credentialSetupChangeDto, type CredentialSetupChangeDto } from './CredentialSetupDto';
import { PasswordSetupService } from './PasswordSetupService';

/**
 * Standard endpoints for the built-in `password` setup flow. Authorization is
 * the opaque setup cookie, not a normal session — a user in setup has none.
 */
@Controller('/auth/credential-setup')
export class CredentialSetupController {
  constructor(private passwords: PasswordSetupService) { }

  @Get('/setup')
  @RateLimit({ limit: 30, window: '15m', key: 'ip' })
  @ResMsg('auth.success.credentialSetupPending')
  status() {
    return this.passwords.status();
  }

  @Post('/change')
  @RateLimit({ limit: 5, window: '15m', key: 'ip' })
  @Validate(credentialSetupChangeDto)
  @ResMsg('auth.success.credentialSetupPasswordReplaced')
  change(@Body() body: CredentialSetupChangeDto) {
    return this.passwords.change(body.newPassword);
  }

  @Post('/cancel')
  @RateLimit({ limit: 10, window: '15m', key: 'ip' })
  @ResMsg('auth.success.credentialSetupCancelled')
  cancel() {
    return this.passwords.cancel();
  }
}

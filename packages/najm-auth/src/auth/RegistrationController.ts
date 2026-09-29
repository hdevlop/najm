import { Body, Controller, Err, Inject, Post, ResMsg } from 'najm-core';
import { RateLimit } from 'najm-rate';
import { Public } from 'najm-guard';
import { Validate } from 'najm-validation';
import { registerDto, type RegisterDto } from '../users/UserDto';
import { AuthService } from './AuthService';
import { authEmailRateLimitKey } from './AuthController';
import { AUTH_CONFIG } from '../auth.tokens';
import type { AuthConfig } from '../types';

/**
 * Public self-registration is isolated from the rest of the auth transport so
 * applications can omit this controller without disabling internal account
 * provisioning through AuthService.
 */
@Controller('/auth')
export class RegistrationController {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;
  constructor(private authService: AuthService) { }

  @Post('/register')
  @Public()
  @RateLimit({ limit: 5, window: '15m', key: authEmailRateLimitKey })
  @Validate(registerDto)
  @ResMsg('auth.success.register')
  async registerUser(@Body() body: RegisterDto) {
    if (this.config.publicRegistration === false) Err('Not Found', 404);
    return this.authService.registerUser(body);
  }
}

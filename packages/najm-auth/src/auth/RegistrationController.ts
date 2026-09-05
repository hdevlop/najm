import { Body, Controller, Post, ResMsg } from 'najm-core';
import { RateLimit } from 'najm-rate';
import { Validate } from 'najm-validation';
import { registerDto, type RegisterDto } from '../users/UserDto';
import { AuthService } from './AuthService';
import { authEmailRateLimitKey } from './AuthController';

/**
 * Public self-registration is isolated from the rest of the auth transport so
 * applications can omit this controller without disabling internal account
 * provisioning through AuthService.
 */
@Controller('/auth')
export class RegistrationController {
  constructor(private authService: AuthService) { }

  @Post('/register')
  @RateLimit({ limit: 5, window: '15m', key: authEmailRateLimitKey })
  @Validate(registerDto)
  @ResMsg('auth.success.register')
  async registerUser(@Body() body: RegisterDto) {
    return this.authService.registerUser(body);
  }
}

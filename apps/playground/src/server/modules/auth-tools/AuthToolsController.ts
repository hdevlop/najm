import { Controller } from 'najm-api';
import { Get, Post, ResMsg } from 'najm-api';
import { Body, Headers, User } from 'najm-api';
import { McpTool, ToolGroup } from 'najm-mcp';
import { Validate } from 'najm-validation';
import { isAuth, isAdmin } from 'najm-auth';
import { AuthService } from 'najm-auth';
import {
  createUserDto,
  loginDto,
  type CreateUserDto,
  type LoginDto,
} from 'najm-auth';

@ToolGroup('auth')
@Controller('/tools/auth')
export class AuthToolsController {
  constructor(private authService: AuthService) {}

  @Post('/register')
  @McpTool({ description: 'Register a new user account with email and password', idempotent: false, openWorld: true, confirm: { level: 'notice', message: 'auth.confirm.register' } })
  @Validate(createUserDto)
  @ResMsg('auth.success.register')
  async register(@Body() body: CreateUserDto) {
    return this.authService.registerUser(body);
  }

  @Post('/login')
  @McpTool({ description: 'Login with email and password, returns access and refresh tokens', readOnly: true })
  @Validate(loginDto)
  @ResMsg('auth.success.login')
  async login(@Body() body: LoginDto) {
    return this.authService.loginUser(body);
  }

  @Post('/refresh')
  @McpTool({ description: 'Refresh access token using the refresh cookie', readOnly: true })
  @ResMsg('auth.success.tokenRefreshed')
  async refresh() {
    return this.authService.refreshTokens();
  }

  @Post('/logout')
  @isAuth()
  @McpTool({ description: 'Logout the authenticated user and revoke tokens', idempotent: true, confirm: { level: 'notice', message: 'auth.confirm.logout' } })
  async logout(
    @User('id') userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.authService.logoutUser(userId, authorization);
  }

  @Get('/me')
  @McpTool({ description: 'Get the current authenticated user profile from cookie', readOnly: true })
  @ResMsg('auth.users.success.retrieved')
  async me() {
    return this.authService.getUserFromCookie();
  }
}

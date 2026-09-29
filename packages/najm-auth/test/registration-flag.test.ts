import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { RegistrationController } from '../src/auth/RegistrationController';
import { AuthController } from '../src/auth/AuthController';
import { CredentialSetupController } from '../src/credentialSetup/CredentialSetupController';
import { OAuthController } from '../src/oauth/OAuthController';
import { GitHubOAuthController } from '../src/oauth/GitHubOAuthController';
import { createGuard, getEffectiveGuards } from 'najm-guard';

describe('public registration flag', () => {
  test('keeps built-in entry and recovery routes usable with default guards', () => {
    class Deny { canActivate() { return false; } }
    const config = { default: [createGuard(Deny)()] };
    for (const [controller, methods] of [
      [AuthController, ['loginUser', 'refreshTokens', 'recoverSession', 'logoutUser', 'userProfile', 'forgotPassword', 'resetPassword']],
      [RegistrationController, ['registerUser']],
      [CredentialSetupController, ['status', 'change', 'cancel']],
      [OAuthController, ['start', 'callback']],
      [GitHubOAuthController, ['start', 'callback']],
    ] as const) {
      for (const method of methods) expect(getEffectiveGuards(controller, method, config), `${controller.name}.${method}`).toEqual([]);
    }
    expect(getEffectiveGuards(AuthController, 'inviteUser', config).length).toBeGreaterThan(0);
  });

  test('returns 404 without calling the registration service when disabled', async () => {
    let called = false;
    const controller = new RegistrationController({
      registerUser: async () => { called = true; return { id: 'unexpected' }; },
    } as any) as any;
    controller.config = { publicRegistration: false };
    await expect(controller.registerUser({ name: 'Probe', email: 'probe@example.test', password: 'unused' }))
      .rejects.toMatchObject({ status: 404 });
    expect(called).toBe(false);
  });
});

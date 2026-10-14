import { describe, expect, test } from 'bun:test';
import { AuthService } from '../src/auth/AuthService';

// An account created without an email address used to be "invited" at "":
// a token was minted for nobody, the mail went nowhere, and with a console
// mailer the caller was told it had been sent.
function fakeService() {
  const calls: string[] = [];
  const service = {
    userService: {
      create: async (data: any) => ({ id: 'U1', name: data.name, email: data.email, role: data.role }),
    },
    tokenService: {
      generateInviteToken: async () => { calls.push('token'); return { token: 't', jti: 'j' }; },
    },
    emailService: {
      send: async (mail: any) => { calls.push(`send ${mail.to}`); return { success: true }; },
    },
    config: { frontendUrl: 'http://localhost', appName: 'App' },
    t: (key: string) => key,
  };
  (service as any).deliverInvitation = (AuthService.prototype as any).deliverInvitation;
  return { calls, service };
}

describe('inviteUser without an email address', () => {
  test.each(['', '   ', undefined])('mints no token, sends nothing and reports nothing delivered (%p)', async (email) => {
    const { calls, service } = fakeService();

    const user = await AuthService.prototype.inviteUser.call(service as any, {
      name: 'Mohammed El Fassi',
      email: email as any,
      role: 'parent',
      status: 'pending',
    } as any);

    expect(user.id).toBe('U1');
    expect(user.emailSent).toBe(false);
    expect(calls).toEqual([]);
  });
});

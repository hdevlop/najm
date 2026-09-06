import { describe, expect, test } from 'bun:test';
import { accountInviteTemplate } from '../src/templates';

describe('accountInviteTemplate', () => {
  test('renders a branded Gmail-safe activation card without exposing the raw token', () => {
    const inviteLink = 'https://kafala360.ma/reset-password?token=secret-token';
    const html = accountInviteTemplate({
      accountType: 'sponsor',
      appName: 'Kafil',
      expiryTime: '3 days',
      inviteLink,
      userName: 'Fatima Zahra',
    });

    expect(html).toContain('<title>Activate your sponsor account | Kafil</title>');
    expect(html).toContain('Activate your sponsor account');
    expect(html).toContain('Activate my sponsor account');
    expect(html).toContain('Email confirmation + password setup');
    expect(html).toContain('background-color:#c9652f');
    expect(html).toContain('color:#ffffff !important');
    expect(html).toContain(`href="${inviteLink}"`);
    expect(html).not.toContain(`>${inviteLink}<`);
    expect(html).not.toContain('word-break: break-all');
    expect(html).not.toContain('Our App');
  });

  test('escapes every caller-provided value used in HTML', () => {
    const html = accountInviteTemplate({
      accountType: '<admin>',
      appName: '<Kafil>',
      expiryTime: '<strong>forever</strong>',
      inviteLink: 'https://example.test/setup?a=1&b=2',
      userName: '<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<admin>');
    expect(html).not.toContain('<Kafil>');
    expect(html).not.toContain('<strong>forever</strong>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('https://example.test/setup?a=1&amp;b=2');
  });
});

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
    expect(html).toContain('>Kafil</p>');
  });

  test('renders an escaped inline logo reference when one is supplied', () => {
    const html = accountInviteTemplate({
      appName: 'Kafil',
      inviteLink: 'https://kafala360.ma/reset-password?token=secret-token',
      logoAlt: 'Kafil <mark>',
      logoSrc: 'cid:najm-account-invite-logo&variant=mail',
      userName: 'Fatima Zahra',
    });

    expect(html).toContain('src="cid:najm-account-invite-logo&amp;variant=mail"');
    expect(html).toContain('alt="Kafil &lt;mark&gt;"');
    expect(html).not.toContain('>Kafil</p>');
  });

  test('a theme replaces the colors and nothing else', () => {
    const html = accountInviteTemplate({
      appName: 'School',
      inviteLink: 'https://school.test/reset-password?token=t',
      userName: 'Amal',
      theme: {
        pageBackground: '#f3f6fb',
        headerBackground: '#1e3a5f',
        accent: '#cc434d',
        button: '#cc434d',
        noteBackground: 'rgb(255, 241, 242)',
        panelTitle: '#1e3a5f',
      },
    });

    expect(html).toContain('background-color:#f3f6fb');
    expect(html).toContain('background-color:#1e3a5f');
    expect(html).toContain('bgcolor="#cc434d"');
    expect(html).toContain('border-left:4px solid #cc434d');
    expect(html).toContain('background-color:rgb(255, 241, 242)');
    expect(html).not.toContain('#c9652f');
    expect(html).not.toContain('#173d2a');
    expect(html).not.toContain('#dc7b3c');
    // A color left out keeps its default.
    expect(html).toContain('color:#40584b');
  });

  test('ignores a color that is not a color, so it cannot add styles', () => {
    const html = accountInviteTemplate({
      inviteLink: 'https://school.test/reset-password?token=t',
      userName: 'Amal',
      theme: {
        button: '#cc434d; background-image:url(https://evil.test/x)',
        headerBackground: 'red" onload="x',
        accent: 'url(https://evil.test/y)',
      },
    });

    expect(html).not.toContain('evil.test');
    expect(html).not.toContain('onload');
    expect(html).toContain('bgcolor="#c9652f"');
    expect(html).toContain('background-color:#173d2a');
  });

  test('a logo plate keeps a dark-on-transparent logo readable on the header', () => {
    const html = accountInviteTemplate({
      appName: 'School',
      inviteLink: 'https://school.test/reset-password?token=t',
      logoSrc: 'cid:logo',
      userName: 'Amal',
      theme: { headerBackground: '#1e3a5f', logoBackground: '#ffffff', logoHeight: 84 },
    });

    expect(html).toContain('background-color:#ffffff; border-radius:18px; padding:12px 16px;');
    expect(html).toContain('height="84"');
    expect(html).toContain('height:84px');
    expect(html).not.toContain('max-height:52px');
  });

  test('the logo height is kept within 16 and 200 pixels', () => {
    const logoSrc = 'cid:logo';
    const base = { inviteLink: 'https://school.test/reset-password?token=t', logoSrc, userName: 'Amal' };

    expect(accountInviteTemplate({ ...base, theme: { logoHeight: 5000 } })).toContain('height="200"');
    expect(accountInviteTemplate({ ...base, theme: { logoHeight: 2 } })).toContain('height="16"');
    expect(accountInviteTemplate({ ...base, theme: { logoHeight: Number.NaN } })).toContain('max-height:52px');
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

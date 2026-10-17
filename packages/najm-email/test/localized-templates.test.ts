import { describe, expect, test } from 'bun:test';
import { accountInviteTemplate, emailTextDirection, passwordResetTemplate } from '../src/templates';

// Security emails were English whatever the recipient's language: the reset
// and invitation templates had no way to take translated words.
describe('localized security email templates', () => {
  const resetLink = 'https://school.test/reset-password?token=abc';

  test('keep the English password reset email when no copy is given', () => {
    const html = passwordResetTemplate({ resetLink, userName: 'Amina' });
    expect(html).toContain('<html>');
    expect(html).toContain('<title>Password Reset</title>');
    expect(html).toContain('<p>Hello Amina,</p>');
    expect(html).toContain('>Reset Password</a>');
    expect(html).toContain('This link will expire in 1 hour for security reasons.');
  });

  test('render the password reset email in the given language, escaped', () => {
    const html = passwordResetTemplate({
      resetLink,
      userName: 'Amina',
      lang: 'fr',
      copy: {
        documentTitle: 'Réinitialisation du mot de passe',
        greeting: 'Bonjour <Amina>,',
        button: 'Réinitialiser le mot de passe',
        expiry: '',
      },
    });
    expect(html).toContain('<html lang="fr" dir="ltr">');
    expect(html).toContain('<title>Réinitialisation du mot de passe</title>');
    expect(html).toContain('<p>Bonjour &lt;Amina&gt;,</p>');
    expect(html).toContain('>Réinitialiser le mot de passe</a>');
    // An empty field keeps the default rather than printing nothing.
    expect(html).toContain('This link will expire in 1 hour');
  });

  test('set right-to-left direction for Arabic', () => {
    expect(emailTextDirection('ar-MA')).toBe('rtl');
    expect(emailTextDirection('fr')).toBe('ltr');
    const html = accountInviteTemplate({
      inviteLink: resetLink,
      userName: 'أمينة',
      appName: 'School',
      lang: 'ar',
      copy: { heading: 'فعّل حسابك', intro: 'أنشأ لك أحد المسؤولين حسابًا <مهم>.' },
    });
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('>فعّل حسابك</h1>');
    expect(html).toContain('أنشأ لك أحد المسؤولين حسابًا &lt;مهم&gt;.');
    expect(html).not.toContain('<strong style="color:#183226;">');
  });

  test('keep the English invitation intro with its emphasised account label', () => {
    const html = accountInviteTemplate({ inviteLink: resetLink, userName: 'Amina', appName: 'School', accountType: 'teacher' });
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain('An administrator created a <strong style="color:#183226;">teacher account</strong> for you on School.');
  });
});

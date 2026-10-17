import 'reflect-metadata';
import { expect, test } from 'bun:test';
import { AuthService } from '../src/auth/AuthService';
import { harness } from './helpers/securityHarness';

// The reset email was English whatever language the request carried: only its
// subject went through the catalog.
const FR: Record<string, string> = {
  'emails.passwordReset.subject': 'Réinitialisez votre mot de passe',
  'emails.passwordReset.greeting': 'Bonjour {{name}},',
  'emails.passwordReset.button': 'Réinitialiser le mot de passe',
};

function authIn(h: Awaited<ReturnType<typeof harness>>, lang: string | (() => string), catalog: Record<string, string>) {
  const sent: Array<{ to: string; subject: string; html: string }> = [];
  const auth = new AuthService(h.tokens, h.users, h.validator, h.encryption,
    h.cookies as never, {} as never, {} as never);
  Object.assign(auth, {
    config: h.config,
    logger: { warn() {} },
    i18nService: { getCurrentLanguage: typeof lang === 'function' ? lang : () => lang },
    t: (key: string, params: Record<string, string> = {}) =>
      (catalog[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => params[name] ?? ''),
    emailService: { sendHtml: async (to: string, subject: string, html: string) => { sent.push({ to, subject, html }); return { success: true }; } },
  });
  return { auth, sent };
}

test('the reset email is written in the active language, English where the catalog has no entry', async () => {
  const h = await harness();
  const { auth, sent } = authIn(h, 'fr', FR);
  await auth.forgotPassword('one@example.test');
  expect(sent).toHaveLength(1);
  expect(sent[0].subject).toBe('Réinitialisez votre mot de passe');
  expect(sent[0].html).toContain('<html lang="fr" dir="ltr">');
  expect(sent[0].html).toMatch(/<p>Bonjour [^<]+,<\/p>/);
  expect(sent[0].html).toContain('>Réinitialiser le mot de passe</a>');
  expect(sent[0].html).toContain('For security, this link can only be used once.');
});

test('a language that cannot be resolved still sends the English email', async () => {
  const h = await harness();
  const { auth, sent } = authIn(h, () => { throw new Error('no request scope'); }, {});
  await auth.forgotPassword('one@example.test');
  expect(sent).toHaveLength(1);
  expect(sent[0].html).toContain('<html>');
  expect(sent[0].html).toContain('>Reset Password</a>');
});

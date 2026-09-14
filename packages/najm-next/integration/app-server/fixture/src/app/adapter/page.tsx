import 'server-only';
import { defineAuth } from 'najm-auth/client/server';
import { defineNajmPreferences } from 'najm-kit/server';
import { createNajmNextServerApp } from 'najm-next/app/next';
import { kafilStyleApp } from '../../najm.config';

export const dynamic = 'force-dynamic';

const auth = defineAuth({ ...kafilStyleApp.auth, recoveryURL: false });
const preferences = defineNajmPreferences({
  i18n: {
    supportedLanguages: ['en', 'fr', 'es'] as const,
    defaultLanguage: 'en' as const,
    normalizeLanguage: (value: unknown) => value === 'fr' || value === 'es' ? value : 'en',
  },
  ...kafilStyleApp.preferences,
});
let settingsReads = 0;
const options = {
  app: kafilStyleApp,
  auth,
  preferences,
  theme: {
    react() {
      const appearance = { designConfig: { version: 1 as const, theme: {}, components: {} }, revision: 1 };
      const branding = { slots: {}, revision: 1, factory: {} };
      return {
        load: async () => ({ appearance, branding }),
        loadAppearance: async () => appearance,
        loadBranding: async () => branding,
      };
    },
  },
  themeOptions: { getServer: async (): Promise<never> => { throw new Error('Unused fixture transport'); } },
  readSettings: async () => ({ sequence: ++settingsReads, language: 'es' }),
  fallbackSettings: { sequence: 0, language: 'en' },
};
const app = createNajmNextServerApp(options);
const institutionApp = createNajmNextServerApp({
  ...options,
  acceptLanguage: false,
  preferenceSources: ({ settings }) => ({ institution: settings }),
});

export default async function Page() {
  const [first, second, institution] = await Promise.all([
    app.loadUiSnapshot(), app.loadUiSnapshot(), institutionApp.loadUiSnapshot(),
  ]);
  if (first !== second) throw new Error('Snapshot was not memoized');
  return <main>{`adapter:${first.session === null}:${first.preferences.language}:${institution.preferences.language}:${first === second}`}</main>;
}

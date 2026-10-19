import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { useQueryClient } from '@tanstack/react-query';
import { createAuthClient } from 'najm-auth/client';
import { useAuthClient } from 'najm-auth/client/react';
import { useTranslation } from 'najm-i18n/react';
import { NTable, useNajmTheme, useNajmTimeZone } from 'najm-kit';
import { NajmAppProvider } from 'najm-next/app/client';

const authClient = createAuthClient({ baseURL: '/api' });
const snapshot = {
  app: { appName: 'UI runtime fixture', currency: 'MAD' }, session: null,
  preferences: { language: 'en', theme: 'light' as const, timeZone: 'Africa/Casablanca' },
  appearance: { revision: 0, designConfig: { version: 1 as const, theme: {} } },
  branding: { revision: 0, slots: {} },
};
const i18n = { translations: { en: { greeting: 'Hello' }, ar: { greeting: 'مرحبا' } }, defaultLanguage: 'en', supportedLanguages: ['en', 'ar'] };
const data = [{ id: 'fixture-1', name: 'Aya' }, { id: 'fixture-2', name: 'Ilyas' }];
const columns = [{ accessorKey: 'name', header: 'Fixture name' }];
let firstQuery: unknown;

function Probe() {
  const query = useQueryClient();
  firstQuery ??= query;
  const sameQuery = firstQuery === query;
  const sameAuth = useAuthClient() === authClient;
  const { language, changeLanguage } = useTranslation();
  const { theme, setTheme } = useNajmTheme();
  const { timeZone, setTimeZone } = useNajmTimeZone();
  const [draft, setDraft] = React.useState('');
  return <>
    <h1>Router-independent UI runtime fixture</h1>
    <output data-testid="state">{JSON.stringify({ language, theme, timeZone, sameQuery, sameAuth })}</output>
    <label>Unsent draft<input value={draft} onChange={event => setDraft(event.target.value)} /></label>
    <button onClick={() => void changeLanguage('ar')}>Arabic</button>
    <button onClick={() => void setTheme('dark')}>Dark</button>
    <button onClick={() => void setTimeZone('Europe/Paris')}>Paris</button>
    <NTable data={data} columns={columns} showAddButton={false} showCheckbox={false} />
  </>;
}

function Fixture() {
  const [generation, setGeneration] = React.useState(0);
  const uiRuntime = React.useMemo(() => ({
    onLanguageChange: async (value: string) => { localStorage.setItem('fixture-language', value); },
    onThemeChange: async (value: 'light' | 'dark') => { localStorage.setItem('fixture-theme', value); },
    onTimeZoneChange: async (value: string) => { localStorage.setItem('fixture-zone', value); },
  }), [generation]);
  return <NajmAppProvider authClient={authClient} snapshot={snapshot} i18n={i18n} uiRuntime={uiRuntime}>
    <button onClick={() => setGeneration(value => value + 1)}>Replace runtime callbacks</button>
    <Probe />
  </NajmAppProvider>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);

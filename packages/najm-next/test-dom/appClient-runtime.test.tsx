import { expect, mock, test } from 'bun:test';
import * as React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { createAuthClient } from 'najm-auth/client';
import { useNajmTheme } from 'najm-kit';
import { useTranslation } from 'najm-i18n/react';
import { NajmAppProvider } from '../src/app/client';

const snapshot = {
  session: null,
  preferences: { language: 'en', theme: 'light' as const, timeZone: 'Africa/Casablanca' },
  appearance: { designConfig: { version: 1 as const, theme: {} }, revision: 0 },
  branding: { slots: {}, revision: 0 },
};

test('the full app provider forwards uiRuntime without a Next router or a second Query client', async () => {
  const clients: object[] = [];
  const authClient = createAuthClient({ baseURL: '/api' });
  const onThemeChange = mock(async () => {});
  const uiRuntime = { onLanguageChange: async () => {}, onThemeChange, onTimeZoneChange: async () => {} };
  function Probe() {
    clients.push(useQueryClient());
    const { theme, setTheme } = useNajmTheme();
    const { language } = useTranslation();
    return <>
      <input aria-label="Draft" defaultValue="" />
      <button onClick={() => void setTheme('dark')}>{language}:{theme}</button>
    </>;
  }
  const tree = (runtime: typeof uiRuntime) => <NajmAppProvider
    authClient={authClient} snapshot={snapshot} uiRuntime={runtime}
    i18n={{ translations: { en: {} }, defaultLanguage: 'en' }}
  ><Probe /></NajmAppProvider>;
  const view = render(tree(uiRuntime));
  const client = clients.at(-1);
  fireEvent.change(view.getByLabelText('Draft'), { target: { value: 'Unsent note' } });
  fireEvent.click(view.getByText('en:light'));
  await waitFor(() => expect(onThemeChange).toHaveBeenCalledWith('dark'));
  view.rerender(tree({ ...uiRuntime }));
  expect(view.getByText('en:dark')).toBeTruthy();
  expect((view.getByLabelText('Draft') as HTMLInputElement).value).toBe('Unsent note');
  expect(clients.every(observed => observed === client)).toBe(true);
});

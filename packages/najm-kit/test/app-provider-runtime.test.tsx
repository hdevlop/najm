import { afterEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { useTranslation } from 'najm-i18n/react';
import { NajmKitProvider, type NajmKitUiRuntime } from '../src/adapters/app';
import { useNajmTheme, useNajmTimeZone } from '../src/providers/preferences';
import { useNajmFormat } from '../src/format/provider';
import { useNBranding } from '../src/components/branding';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const i18n = { translations: { en: { greeting: 'Hello' }, ar: { greeting: 'مرحبا' } }, defaultLanguage: 'en', supportedLanguages: ['en', 'ar'] };
const snapshot = {
  app: { appName: 'Runtime fixture', currency: 'MAD' },
  preferences: { language: 'en', theme: 'light' as const, timeZone: 'Africa/Casablanca' },
  appearance: { designConfig: { version: 1 as const, theme: {} } },
  branding: { slots: {} },
};
function runtime(): NajmKitUiRuntime {
  return { onLanguageChange: mock(async () => {}), onThemeChange: mock(async () => {}), onTimeZoneChange: mock(async () => {}) };
}
function Probe() {
  const { t, language, changeLanguage } = useTranslation();
  const { theme, setTheme } = useNajmTheme();
  const { timeZone, setTimeZone } = useNajmTimeZone();
  const format = useNajmFormat();
  const branding = useNBranding();
  const [error, setError] = React.useState('');
  return <>
    <output data-testid="values">{JSON.stringify({ language, greeting: t('greeting'), theme, timeZone, currency: format.currency, name: branding?.appName })}</output>
    <input aria-label="Draft" defaultValue="" />
    <button onClick={() => void changeLanguage('ar')}>Language</button>
    <button onClick={() => void setTheme('dark').catch(error => setError(error.message))}>Theme</button>
    <button onClick={() => void setTimeZone('Europe/Paris')}>Time zone</button>
    <output data-testid="error">{error}</output>
  </>;
}

describe('NajmKitProvider explicit UI runtime', () => {
  test('mounts without a router, preserves shared contexts, and persists through host callbacks only', async () => {
    const fetch = mock(async () => { throw new Error('Unexpected network request'); });
    globalThis.fetch = fetch as never;
    const host = runtime();
    const view = render(<NajmKitProvider snapshot={snapshot} i18n={i18n} uiRuntime={host}><Probe /></NajmKitProvider>);
    expect(JSON.parse(view.getByTestId('values').textContent!)).toMatchObject({ language: 'en', theme: 'light', currency: 'MAD', name: 'Runtime fixture' });
    fireEvent.click(view.getByText('Language'));
    fireEvent.click(view.getByText('Theme'));
    fireEvent.click(view.getByText('Time zone'));
    await waitFor(() => expect(host.onTimeZoneChange).toHaveBeenCalledWith('Europe/Paris'));
    expect(host.onLanguageChange).toHaveBeenCalledWith('ar');
    expect(host.onThemeChange).toHaveBeenCalledWith('dark');
    expect(JSON.parse(view.getByTestId('values').textContent!)).toMatchObject({ language: 'ar', greeting: 'مرحبا', theme: 'dark', timeZone: 'Europe/Paris' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('uses refreshed callbacks without remounting child drafts or preferences', async () => {
    const first = runtime();
    const next = runtime();
    const tree = (host: NajmKitUiRuntime) => <NajmKitProvider snapshot={snapshot} i18n={i18n} uiRuntime={host}><Probe /></NajmKitProvider>;
    const view = render(tree(first));
    fireEvent.change(view.getByLabelText('Draft'), { target: { value: 'Keep this draft' } });
    fireEvent.click(view.getByText('Theme'));
    await waitFor(() => expect(first.onThemeChange).toHaveBeenCalledWith('dark'));
    view.rerender(tree(next));
    expect((view.getByLabelText('Draft') as HTMLInputElement).value).toBe('Keep this draft');
    expect(JSON.parse(view.getByTestId('values').textContent!).theme).toBe('dark');
    fireEvent.click(view.getByText('Time zone'));
    await waitFor(() => expect(next.onTimeZoneChange).toHaveBeenCalledWith('Europe/Paris'));
    expect(first.onTimeZoneChange).not.toHaveBeenCalled();
  });

  test('propagates persistence failure to the setter caller', async () => {
    const host = { ...runtime(), onThemeChange: async () => { throw new Error('Local storage unavailable'); } };
    const view = render(<NajmKitProvider snapshot={snapshot} i18n={i18n} uiRuntime={host}><Probe /></NajmKitProvider>);
    fireEvent.click(view.getByText('Theme'));
    await waitFor(() => expect(view.getByTestId('error').textContent).toBe('Local storage unavailable'));
  });

  test('also supports the no-catalog branch without a router', () => {
    function Theme() { return <span>{useNajmTheme().theme}</span>; }
    const view = render(<NajmKitProvider initialTheme="dark" uiRuntime={runtime()}><Theme /></NajmKitProvider>);
    expect(view.getByText('dark')).toBeTruthy();
  });

  test('rejects incomplete runtime objects instead of silently omitting persistence', () => {
    expect(() => render(<NajmKitProvider uiRuntime={{} as never}><span /></NajmKitProvider>)).toThrow('uiRuntime must supply');
    expect(() => render(<NajmKitProvider uiRuntime={null as never}><span /></NajmKitProvider>)).toThrow('uiRuntime must supply');
  });
});

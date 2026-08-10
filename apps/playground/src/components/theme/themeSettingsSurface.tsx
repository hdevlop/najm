'use client';

import { useRouter } from 'next/navigation';
import { NThemeSettings, NThemeSettingsProvider } from 'najm-theme/react';

/**
 * The package's settings composite, mounted under its provider.
 *
 * No client or `baseUrl` is passed: the settings client already defaults to
 * the standard `/api/theme` mount, and the RSC bootstrap and the branding
 * routes all live under it. What the application supplies is the refresh
 * callback, so a save propagates to the *server* render rather than waiting
 * for the next navigation.
 */
export function ThemeSettingsSurface() {
  const router = useRouter();

  return (
    <NThemeSettingsProvider onPersisted={() => router.refresh()}>
      <NThemeSettings />
    </NThemeSettingsProvider>
  );
}

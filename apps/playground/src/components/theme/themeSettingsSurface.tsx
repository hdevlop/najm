'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palette } from 'lucide-react';
import { NSheet } from 'najm-kit';
import {
  NThemeSettings,
  NThemeSettingsActions,
  NThemeSettingsProvider,
} from 'najm-theme/react';

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
  const [open, setOpen] = useState(true);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) router.push('/dashboard');
  };

  return (
    <NThemeSettingsProvider onPersisted={() => router.refresh()}>
      <NSheet
        open={open}
        onOpenChange={handleOpenChange}
        icon={Palette}
        title="Theme & branding"
        description="Appearance, presets, and brand assets"
        width={560}
        classNames={{
          body: 'p-0 lg:p-0 2xl:p-0',
          footer: 'py-2',
        }}
        footer={
          <NThemeSettingsActions
            className="najm-theme-actions--sheet-footer"
            display="compact"
            showStatus={false}
            showFileActions
            showDiscard={false}
          />
        }
      >
        <NThemeSettings className="p-3 2xl:p-4" showActions={false} />
      </NSheet>
    </NThemeSettingsProvider>
  );
}

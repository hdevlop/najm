'use client';

import { NThemeSettingsProvider, NThemeSettings } from 'najm-theme/react';

// A Client Component importing the *client* entry, in the same build as the
// server entries above. This is the boundary the export map has to keep apart:
// the page compiles for the browser, the layouts compile for `react-server`.
export default function Page() {
  return (
    <NThemeSettingsProvider client={{ baseUrl: '/api/theme' }}>
      <NThemeSettings />
    </NThemeSettingsProvider>
  );
}

import type { Metadata } from 'next';
import { ThemeSettingsSurface } from '@/components/theme/themeSettingsSurface';

export const metadata: Metadata = {
  title: 'Theme settings — Najm Playground',
};

// ============================================================================
// Playground — the Theme & Branding settings surface
// ============================================================================
//
// The route opens the package sections in Najm Kit's standard sheet shell.
// Appearance tokens, theme presets, and the four branding slots still come
// from `najm-theme/react`; the application owns only their placement.
//
// It is deliberately the package's own composite rather than a hand-built
// arrangement of the exported sections: the point of the visual pass is to see
// what a consumer gets for free, and a bespoke surface here would prove that a
// bespoke surface works.
// ============================================================================

export default function ThemeSettingsPage() {
  return <ThemeSettingsSurface />;
}

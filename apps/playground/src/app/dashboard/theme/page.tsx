import type { Metadata } from 'next';
import { ThemeSettingsSurface } from '@/components/theme/themeSettingsSurface';

export const metadata: Metadata = {
  title: 'Theme settings — Najm Playground',
};

// ============================================================================
// Playground — the Theme & Branding settings surface
// ============================================================================
//
// The whole page. Appearance tokens, theme presets, and the four branding slots
// come from `najm-theme/react`; this application supplies a heading and a
// container.
//
// It is deliberately the package's own composite rather than a hand-built
// arrangement of the exported sections: the point of the visual pass is to see
// what a consumer gets for free, and a bespoke surface here would prove that a
// bespoke surface works.
// ============================================================================

export default function ThemeSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Theme &amp; branding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Appearance, presets, and the four branding slots. Reset restores the files this
          build ships in <code className="rounded bg-secondary px-1 py-0.5">theme/</code>.
        </p>
      </header>

      <ThemeSettingsSurface />
    </div>
  );
}

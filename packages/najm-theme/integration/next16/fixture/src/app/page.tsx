import { loadServerAppearance, loadServerBranding } from '../serverTheme';
import { NThemeBrandingProvider, NThemeImage } from 'najm-theme/react';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const appearance = await loadServerAppearance();
  const branding = await loadServerBranding();

  // The bootstrap enriches its branding return with the factory map; reading it
  // here is the assertion that `defineTheme(import.meta.url)` found `theme.json`
  // and all four images next to the fixture's `theme/index.ts` after Next
  // bundled it.
  const factory = branding.factory ?? {};
  const factoryKeys = Object.keys(factory).sort().join(',');
  if (factoryKeys !== 'authHeroImage,authLogo,sidebarLogoCollapsed,sidebarLogoExpanded') {
    throw new Error(`the factory theme directory did not resolve: ${factoryKeys}`);
  }

  return (
    <NThemeBrandingProvider branding={branding}>
      <main data-page={appearance.revision} data-slots={factoryKeys}>
        <NThemeImage slot="authLogo" alt="Acme" data-testid="auth-logo" />
        {`page:${appearance.revision}`}
      </main>
    </NThemeBrandingProvider>
  );
}

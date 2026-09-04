import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { NajmMode } from 'najm-kit';
import { NajmAppProvider } from 'najm-kit/app';
import { NThemeBrandingProvider } from 'najm-theme/react';
import { loadServerTheme } from '@/lib/serverTheme';
import { Toaster } from '@/components/ui/sonner';
import '@/styles/index.css';
import { auth } from '@/lib/auth';
import { playgroundI18n, playgroundLocales, type Locale } from '@/locales';
import { AuthProviderWrapper } from '@/providers/AuthProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { UI_THEME_COOKIE } from '@/app/api/ui-theme/route';
import { UI_LANGUAGE_COOKIE } from '@/app/api/ui-language/route';
import { UI_TIME_ZONE_COOKIE } from '@/app/api/ui-timezone/route';

export const metadata: Metadata = {
  title: 'Najm Playground',
  description: 'Next.js + Najm API Playground',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.getSession().catch(() => null);

  // One shared resolution for this render: the stored design and the resolved
  // marks, or — independently, if either endpoint is unreachable — the files in
  // `theme/`. Every layout and page below reads the same snapshot.
  const { appearance, branding } = await loadServerTheme();

  const cookieStore = await cookies();
  const theme: NajmMode =
    cookieStore.get(UI_THEME_COOKIE)?.value === 'light' ? 'light' : 'dark';
  // One normalizer, derived from the catalog. A cookie holding a language the
  // app no longer ships coerces to the default rather than rendering keys.
  const language: Locale = playgroundI18n.normalizeLanguage(
    cookieStore.get(UI_LANGUAGE_COOKIE)?.value,
  );
  // Seeds the provider so a reload renders dates in the chosen zone rather than
  // falling back to UTC. The provider re-validates it.
  const timeZone = cookieStore.get(UI_TIME_ZONE_COOKIE)?.value;

  return (
    <html
      lang={language}
      dir={playgroundI18n.direction(language)}
      className={theme === 'dark' ? 'dark' : undefined}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <QueryProvider>
          <AuthProviderWrapper initialSession={session}>
            <NajmAppProvider
              translations={playgroundI18n.translations}
              initialLanguage={language}
              defaultLanguage={playgroundI18n.defaultLanguage}
              fallbackToDefaultLanguage={playgroundI18n.fallbackToDefaultLanguage}
              getLanguageDirection={playgroundI18n.direction}
              initialTheme={theme}
              initialTimeZone={timeZone}
              initialDesign={appearance.designConfig}
              initialBranding={branding}
              appName="Najm Playground"
              formDevTools
              currency="MAD"
              locales={playgroundLocales}
            >
              <NThemeBrandingProvider branding={branding}>
                {children}
              </NThemeBrandingProvider>
            </NajmAppProvider>
          </AuthProviderWrapper>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}

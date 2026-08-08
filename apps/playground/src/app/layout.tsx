import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { NajmDesignConfig, NajmMode } from 'najm-kit';
import { NajmAppProvider } from 'najm-kit/app';
import { Toaster } from '@/components/ui/sonner';
import '@/styles/index.css';
import { auth } from '@/lib/auth';
import { translations, type Locale } from '@/locales';
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

/**
 * Stands in for the design an application would load from its own API. It is
 * only the *seed* — `/ui-provider` edits it live through `useNajmDesignEditor`,
 * which is the point: no provider file here owns design state.
 */
const DESIGN: NajmDesignConfig = {
  version: 1,
  theme: { accent: 'emerald', radius: '0.5rem' },
  components: {},
  typography: { scale: 'default' },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.getSession().catch(() => null);

  const cookieStore = await cookies();
  const theme: NajmMode =
    cookieStore.get(UI_THEME_COOKIE)?.value === 'light' ? 'light' : 'dark';
  const language = (
    cookieStore.get(UI_LANGUAGE_COOKIE)?.value === 'fr' ? 'fr' : 'en'
  ) satisfies Locale;
  // Seeds the provider so a reload renders dates in the chosen zone rather than
  // falling back to UTC. The provider re-validates it.
  const timeZone = cookieStore.get(UI_TIME_ZONE_COOKIE)?.value;

  return (
    <html
      lang={language}
      className={theme === 'dark' ? 'dark' : undefined}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <QueryProvider>
          <AuthProviderWrapper initialSession={session}>
            <NajmAppProvider
              translations={translations}
              initialLanguage={language}
              initialTheme={theme}
              initialTimeZone={timeZone}
              initialDesign={DESIGN}
              appName="Najm Playground"
              currency="MAD"
              locales={{ en: 'en-MA', fr: 'fr-MA' }}
            >
              {children}
            </NajmAppProvider>
          </AuthProviderWrapper>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}

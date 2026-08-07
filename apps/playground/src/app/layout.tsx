import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { NajmMode } from 'najm-kit';
import { NajmAppProvider } from 'najm-kit/app';
import { Toaster } from '@/components/ui/sonner';
import '@/styles/index.css';
import { auth } from '@/lib/auth';
import { translations, type Locale } from '@/locales';
import { AuthProviderWrapper } from '@/providers/AuthProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { UI_THEME_COOKIE } from '@/app/api/ui-theme/route';
import { UI_LANGUAGE_COOKIE } from '@/app/api/ui-language/route';

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

  // Paint the theme server-side from the same cookie the provider is seeded
  // with, so the first frame already matches and there is no flash to correct.
  const cookieStore = await cookies();
  const theme: NajmMode =
    cookieStore.get(UI_THEME_COOKIE)?.value === 'light' ? 'light' : 'dark';
  const language = (
    cookieStore.get(UI_LANGUAGE_COOKIE)?.value === 'fr' ? 'fr' : 'en'
  ) satisfies Locale;

  return (
    <html
      lang={language}
      className={theme === 'dark' ? 'dark' : undefined}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {/* Auth and react-query are the application's, mounted from its own
            files. Everything below them — language, theme, time zone, design,
            branding, NTable defaults — is one component from the kit, and this
            app authors no provider file for any of it. */}
        <QueryProvider>
          <AuthProviderWrapper initialSession={session}>
            <NajmAppProvider
              translations={translations}
              initialLanguage={language}
              initialTheme={theme}
              branding={{ appName: 'Najm Playground' }}
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

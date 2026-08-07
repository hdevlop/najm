import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { NajmMode } from 'najm-kit';
import { Toaster } from '@/components/ui/sonner';
import '@/styles/index.css';
import { auth } from '@/lib/auth';
import { AppProviders } from '@/providers';
import { UI_THEME_COOKIE } from '@/app/api/ui-theme/route';

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

  return (
    <html
      lang="en"
      className={theme === 'dark' ? 'dark' : undefined}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <AppProviders initialSession={session} initialTheme={theme}>
          {children}
        </AppProviders>
        <Toaster />
      </body>
    </html>
  );
}

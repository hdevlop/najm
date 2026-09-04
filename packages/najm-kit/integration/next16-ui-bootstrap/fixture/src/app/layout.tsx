import { cookies } from 'next/headers';
import { loadServerUiBootstrap } from '../serverLoader';
import { preferences } from '../preferences';

// The root layout resolves both resources on every navigation, exactly as a
// real app does to seed its providers. Everything below it must reuse this.
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [{ appearance, branding }, cookieStore] = await Promise.all([
    loadServerUiBootstrap(),
    cookies(),
  ]);

  // Next's own cookie store, passed straight in. The structural reader is what
  // keeps `najm-kit/server` free of a `next` import while still accepting it.
  const { language, theme, timeZone } = preferences.resolve(cookieStore, {
    languageFallback: 'fr',
  });

  return (
    <html lang={language} data-time-zone={timeZone} className={theme === 'dark' ? 'dark' : ''}>
      <body>
        <header
          data-root-revision={appearance.revision}
          data-root-logo={branding.sidebarLogoExpandedPath}
        >
          {`root:${appearance.revision}:${branding.sidebarLogoExpandedPath}`}
        </header>
        <p data-preferences>{`prefs:${language}:${theme}:${timeZone}`}</p>
        {children}
      </body>
    </html>
  );
}

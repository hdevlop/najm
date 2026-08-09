import { loadServerUiBootstrap } from '../serverLoader';

// The root layout resolves both resources on every navigation, exactly as a
// real app does to seed its providers. Everything below it must reuse this.
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { appearance, branding } = await loadServerUiBootstrap();

  return (
    <html lang="en">
      <body>
        <header
          data-root-revision={appearance.revision}
          data-root-logo={branding.sidebarLogoExpandedPath}
        >
          {`root:${appearance.revision}:${branding.sidebarLogoExpandedPath}`}
        </header>
        {children}
      </body>
    </html>
  );
}

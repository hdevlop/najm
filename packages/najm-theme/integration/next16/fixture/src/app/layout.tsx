import { loadServerTheme } from '../serverTheme';

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { appearance, branding } = await loadServerTheme();

  return (
    <html lang="en">
      <body>
        <header data-root={`${appearance.revision}:${branding.slots.sidebarLogoExpanded}`}>
          {`root:${appearance.revision}`}
        </header>
        {children}
      </body>
    </html>
  );
}

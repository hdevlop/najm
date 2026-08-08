import { serverAuth } from '../session';

// The root layout resolves the session on every navigation, exactly as a real
// app does to render a header. Everything below it must reuse this result.
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await serverAuth.getSession();

  return (
    <html lang="en">
      <body>
        <header data-root-user={session?.user.id ?? 'anonymous'}>
          {`root:${session?.user.id ?? 'anonymous'}`}
        </header>
        {children}
      </body>
    </html>
  );
}

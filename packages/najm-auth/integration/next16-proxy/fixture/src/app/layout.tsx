import { serverAuth } from '../session';
import { headers } from 'next/headers';

// The root layout resolves the session on every navigation, exactly as a real
// app does to render a header. Everything below it must reuse this result.
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session, requestHeaders] = await Promise.all([
    serverAuth.getSession(),
    headers(),
  ]);
  const nonce = requestHeaders.get('x-nonce') ?? 'missing';

  return (
    <html lang="en">
      <body data-nonce={nonce}>
        <header data-root-user={session?.user.id ?? 'anonymous'}>
          {`root:${session?.user.id ?? 'anonymous'}`}
        </header>
        {children}
      </body>
    </html>
  );
}

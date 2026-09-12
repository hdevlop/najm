import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const nonce = requestHeaders.get('x-nonce') ?? 'missing';

  return (
    <html lang="en">
      <body data-nonce={nonce}>{children}</body>
    </html>
  );
}

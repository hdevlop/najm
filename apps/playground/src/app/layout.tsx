import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/sonner';
import '@/styles/index.css';
import { AppProviders } from '@/providers';

export const metadata: Metadata = {
  title: 'Najm Playground',
  description: 'Next.js + Najm API Playground',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
        <Toaster />
      </body>
    </html>
  );
}

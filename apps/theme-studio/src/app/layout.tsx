import type { Metadata } from 'next';
import 'overlayscrollbars/overlayscrollbars.css';
import '../index.css';

export const metadata: Metadata = {
  title: 'Najm Theme Studio',
  description: 'Local Najm theme project and style manager',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
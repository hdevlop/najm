import type { Metadata } from 'next';
import 'overlayscrollbars/overlayscrollbars.css';
import '../index.css';

const THEME_STUDIO_FONT_HREF =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=Cormorant+Garamond:wght@400;500;600;700',
    'family=DM+Sans:wght@400;500;600;700',
    'family=Fira+Code:wght@400;500;600',
    'family=Geist:wght@400;500;600;700',
    'family=IBM+Plex+Mono:wght@400;500;600',
    'family=IBM+Plex+Sans:wght@400;500;600;700',
    'family=Inter:wght@400;500;600;700',
    'family=JetBrains+Mono:wght@400;500;600',
    'family=Libre+Baskerville:wght@400;700',
    'family=Lora:wght@400;500;600;700',
    'family=Manrope:wght@400;500;600;700',
    'family=Merriweather:wght@400;700',
    'family=Outfit:wght@400;500;600;700',
    'family=Playfair+Display:wght@400;500;600;700',
    'family=Plus+Jakarta+Sans:wght@400;500;600;700',
    'family=Roboto+Mono:wght@400;500;600',
    'family=Sora:wght@400;500;600;700',
    'family=Source+Code+Pro:wght@400;500;600',
    'family=Source+Sans+3:wght@400;500;600;700',
    'family=Space+Grotesk:wght@400;500;600;700',
    'family=Space+Mono:wght@400;700',
    'family=Work+Sans:wght@400;500;600;700',
  ].join('&') +
  '&display=swap';

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={THEME_STUDIO_FONT_HREF} />
      </head>
      <body>{children}</body>
    </html>
  );
}

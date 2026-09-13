import { loadKafilSettings } from '../../server';

// Nested boundary: reads only the settings projection off the same shared
// resolution the page's snapshot read primes.
export default async function KafilLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await loadKafilSettings();

  return (
    <section data-kafil-settings={String(settings.enabled)}>
      <p>{`kafil-layout:${settings.enabled}`}</p>
      {children}
    </section>
  );
}

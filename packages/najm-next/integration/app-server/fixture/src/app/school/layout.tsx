import { loadSchoolSettings } from '../../server';

export default async function SchoolLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await loadSchoolSettings();

  return (
    <section data-school-currency={settings?.currency ?? 'fallback'}>
      <p>{`school-layout:${settings?.currency ?? 'fallback'}`}</p>
      {children}
    </section>
  );
}

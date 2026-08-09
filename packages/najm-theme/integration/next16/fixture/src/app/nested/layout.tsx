import { loadServerBranding } from '../../serverTheme';

export const dynamic = 'force-dynamic';

export default async function NestedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const branding = await loadServerBranding();
  return (
    <section data-nested={branding.revision}>
      {`nested:${branding.revision}`}
      {children}
    </section>
  );
}

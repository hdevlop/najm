import { loadServerBranding } from '../../serverLoader';

/**
 * A nested layout that only wants branding, reached through the per-resource
 * accessor. The root layout above already resolved the whole bootstrap; if the
 * adapter did its job this adds no endpoint hit and sees the same logo.
 */
export default async function SharedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const branding = await loadServerBranding();

  return (
    <section data-layout-logo={branding.sidebarLogoExpandedPath}>
      <p>{`layout:${branding.sidebarLogoExpandedPath}`}</p>
      {children}
    </section>
  );
}

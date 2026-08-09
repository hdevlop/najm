import { loadServerAppearance, loadServerBranding } from '../../serverLoader';

/** The third server boundary in one navigation, reading both resources. */
export default async function SharedPage() {
  const [appearance, branding] = await Promise.all([
    loadServerAppearance(),
    loadServerBranding(),
  ]);

  return (
    <main data-page-revision={appearance.revision} data-page-logo={branding.sidebarLogoExpandedPath}>
      {`page:${appearance.revision}:${branding.sidebarLogoExpandedPath}:${appearance.designConfig.typography?.baseSize ?? 'none'}`}
    </main>
  );
}

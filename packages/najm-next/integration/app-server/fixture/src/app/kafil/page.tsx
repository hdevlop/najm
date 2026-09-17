import { loadKafilSnapshot } from '../../server';
import { KafilClientProviders } from '../../clientProviders';

// Page boundary: reads the full snapshot. The layout above already primed the
// settings resolution; all three must agree on one backend read each.
export default async function KafilPage() {
  const snapshot = await loadKafilSnapshot();
  const session = snapshot.session ? 'signed-in' : 'anonymous';

  return <KafilClientProviders snapshot={snapshot}>
    <main
      data-kafil-language={snapshot.preferences.language}
      data-kafil-app-name={snapshot.app.appName}
      data-kafil-app-currency={snapshot.app.currency}
      data-kafil-revision={snapshot.appearance.revision}
      data-kafil-logo={snapshot.branding.logo}
    >
      {`kafil:${session}:${snapshot.preferences.language}:${snapshot.preferences.theme}:${snapshot.preferences.timeZone}:${snapshot.preferences.currency}:${snapshot.appearance.revision}:${snapshot.branding.logo}:${snapshot.settings.enabled}`}
    </main>
  </KafilClientProviders>;
}

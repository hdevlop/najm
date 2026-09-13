import { loadSchoolSnapshot } from '../../server';
import { SchoolClientProviders } from '../../clientProviders';

export default async function SchoolPage() {
  const snapshot = await loadSchoolSnapshot();
  const session = snapshot.session ? 'signed-in' : 'anonymous';

  return <SchoolClientProviders snapshot={snapshot}>
    <main
      data-school-language={snapshot.preferences.language}
      data-school-currency={snapshot.preferences.currency}
    >
      {`school:${session}:${snapshot.preferences.language}:${snapshot.preferences.theme}:${snapshot.preferences.timeZone}:${snapshot.preferences.currency}:${snapshot.appearance.revision}:${snapshot.branding.logo}`}
    </main>
  </SchoolClientProviders>;
}

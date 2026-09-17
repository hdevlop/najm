import { DirectClientProvider, type DirectFixtureSnapshot } from '../../directClientProvider';

const snapshot: DirectFixtureSnapshot = {
  app: { appName: 'Direct fixture', currency: 'MAD' },
  session: null,
  preferences: {
    language: 'en',
    theme: 'light',
    timeZone: 'Africa/Casablanca',
  },
  appearance: {
    designConfig: { version: 1, theme: {}, components: {} },
    revision: 1,
  },
  branding: { slots: {}, revision: 1 },
  settings: { locationConfig: { provider: 'disabled' } },
};

export default function DirectPage() {
  return (
    <DirectClientProvider snapshot={snapshot}>
      <main>direct-provider-fixture</main>
    </DirectClientProvider>
  );
}

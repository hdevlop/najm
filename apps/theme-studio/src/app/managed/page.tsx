import 'reflect-metadata';
import Link from 'next/link';
import { loadServerAppearance, loadServerBranding } from '@/server/serverTheme';
import { ManagedMode } from './ManagedMode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Managed mode — Najm Theme Studio',
  description: 'najm-theme driving a running application, resolved from the published package',
};

/**
 * Two independent reads, one request-scoped resolution.
 *
 * `loadServerAppearance` and `loadServerBranding` are separate calls that share
 * one fetch per resource per request — the point of the RSC bootstrap. They also
 * fall back independently, so a branding outage still paints a correct theme.
 */
export default async function ManagedPage() {
  const [appearance, branding] = await Promise.all([
    loadServerAppearance(),
    loadServerBranding(),
  ]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div>
            <h1 className="text-lg font-semibold">Managed mode</h1>
            <p className="text-sm text-muted-foreground">
              <code>najm-theme</code> resolved from <code>node_modules</code>, driving this page
              through its own database, revisions, and storage.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Back to projects
          </Link>
        </div>
      </header>

      <ManagedMode
        initialDesign={appearance.designConfig}
        initialRevision={appearance.revision}
        initialSlots={branding.slots}
      />
    </main>
  );
}

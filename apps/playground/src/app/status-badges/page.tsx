'use client';

import { useTranslation } from 'najm-i18n/react';
import { NBadge, NButton, NajmUIProvider } from 'najm-kit';
import { formatStatusLabel } from 'najm-kit/format';

/**
 * Acceptance harness for the packaged status vocabulary.
 *
 * This app registers no status colors, no token-to-key map, and no badge
 * defaults. What to look at:
 *
 * 1. **Colors and labels with nothing declared.** Every badge below is
 *    `<NBadge status="…" />` and nothing else. Wrong color or a raw token means
 *    the packaged vocabulary missed a status a real dashboard renders.
 * 2. **Soft and pill are the status default.** The content badges in the last
 *    row must stay solid and square-cornered — provider policy is status
 *    policy, and so is the package's.
 * 3. **The application's catalog still wins.** `status.in_preparation` and
 *    `status.delivered` are the only two entries this app declares, and they
 *    must beat the packaged wording. Every other badge comes from the package.
 * 4. **Switching language relabels everything, including the two overrides.**
 *    No remount, no reload.
 * 5. **All four packaged languages, side by side.** The ar/es rows mount their
 *    own `NajmUIProvider language="…"` with no catalog at all, which is also
 *    the standalone case: no auth, no Query, no app-wide i18n.
 * 6. **Plain text agrees with the badge.** Each row repeats its labels through
 *    `formatStatusLabel` from the server-safe `najm-kit/format` leaf. A row
 *    where the two columns disagree is the bug this shared resolver exists to
 *    prevent.
 */

const LIFECYCLE = ['draft', 'pending', 'approved', 'active', 'paused', 'ended', 'archived'];
const FULFILMENT = [
  'pending_funding',
  'in_preparation',
  'purchased',
  'out_for_delivery',
  'delivered',
  'cancelled',
];
const PAYMENT = ['paid', 'partially_paid', 'unpaid', 'overdue', 'refunded', 'expired'];
const ATTENDANCE = ['present', 'absent', 'late', 'scheduled', 'in_progress', 'completed'];
const UNKNOWN = ['bespoke_state', 'awaiting_courier_pickup'];

function Row({
  title,
  statuses,
  language,
  t,
}: Readonly<{
  title: string;
  statuses: string[];
  language?: string;
  t?: (key: string) => string;
}>) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="flex flex-wrap items-center gap-2">
        {statuses.map((status) => (
          <NBadge key={status} status={status} />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {statuses
          .map((status) => formatStatusLabel(status, { language, t }))
          .join(' · ')}
      </p>
    </section>
  );
}

function Translated({ title, statuses }: Readonly<{ title: string; statuses: string[] }>) {
  const { t, language } = useTranslation();
  return <Row title={title} statuses={statuses} language={language} t={t} />;
}

/** A provider tree of its own, with a language and no catalog behind it. */
function Standalone({ language, label }: Readonly<{ language: string; label: string }>) {
  return (
    <NajmUIProvider language={language}>
      <div dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <Row
          title={label}
          statuses={[...FULFILMENT, 'overdue', 'present']}
          language={language}
        />
      </div>
    </NajmUIProvider>
  );
}

export default function StatusBadgesPage() {
  const { language, changeLanguage } = useTranslation();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Status badges</h1>
        <p className="text-muted-foreground text-sm">
          Every badge on this page is <code>&lt;NBadge status=&quot;…&quot; /&gt;</code>.
          This app declares no status map, no label map and no badge defaults —
          only two catalog entries it words differently.
        </p>
        <div>
          <NButton
            variant="outline"
            onClick={() => void changeLanguage(language === 'fr' ? 'en' : 'fr')}
          >
            Switch to {language === 'fr' ? 'English' : 'French'}
          </NButton>
        </div>
      </header>

      <Translated title="Lifecycle" statuses={LIFECYCLE} />
      <Translated
        title="Fulfilment — in preparation and delivered are this app's wording"
        statuses={FULFILMENT}
      />
      <Translated title="Payment" statuses={PAYMENT} />
      <Translated title="Attendance and progress" statuses={ATTENDANCE} />
      <Translated
        title="Unknown tokens humanize, and never render a catalog key"
        statuses={UNKNOWN}
      />

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          Application overrides still win, per badge
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <NBadge status="delivered" label="Signed for" />
          <NBadge status="pending" look="solid" />
          <NBadge status="paid" shape="square" size="lg" />
          <NBadge status="failed" showIcon icon="triangle-alert" />
          <NBadge status="active" statusMap={{ active: 'info' }} />
        </div>
        <p className="text-muted-foreground text-xs">
          Explicit label, look, shape, size, icon and color — each one beats the
          packaged default for that badge alone.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Content badges keep their own defaults</h3>
        <div className="flex flex-wrap items-center gap-2">
          <NBadge>Beta</NBadge>
          <NBadge color="secondary">Draft copy</NBadge>
          <NBadge color="neutral" look="outline">v2.16</NBadge>
        </div>
        <p className="text-muted-foreground text-xs">
          Solid, square-cornered. Soft and pill belong to statuses.
        </p>
      </section>

      <Standalone language="ar" label="Arabic — own provider, no catalog (RTL)" />
      <Standalone language="es" label="Spanish — own provider, no catalog" />
    </main>
  );
}

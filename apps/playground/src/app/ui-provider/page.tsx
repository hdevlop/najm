'use client';

import { useTranslation } from 'najm-i18n/react';
import {
  NButton,
  NTable,
  useNBranding,
  useNBrandingEditor,
  useNajmDesignEditor,
  useNajmTheme,
  useNajmTimeZone,
  type NTableColumnDef,
} from 'najm-kit';

/**
 * Acceptance harness for `NajmAppProvider`.
 *
 * Nothing here mounts a provider and this app authors no provider file for any
 * of it — the whole stack is one component in the root layout. Six things are
 * being checked:
 *
 * 1. `useNajmTheme().setTheme` flips the class, POSTs `/api/ui-theme`, and
 *    survives a reload, which only works if the cookie round trip is real.
 * 2. `useNajmTimeZone()` reads through the same provider.
 * 3. `changeLanguage` swaps the catalog *without* a router refresh, and the
 *    table labels below re-render in the new language.
 * 4. The `NTable` inherits its pagination labels from the catalog, derived by
 *    the provider rather than passed in. A literal `common.pagination.*` string
 *    in the pagination bar means a catalog field name does not match the kit's
 *    — the failure this harness exists to make visible, since nothing in the
 *    type system or the test suite can see it.
 * 5. `useNajmDesignEditor` drafts a design from *below* the design context and
 *    the whole page restyles as it is dragged. This is the one that used to
 *    force an application into a provider file of its own: `design` was a prop,
 *    so the draft state had to live above `NajmAppProvider`, and the component
 *    that owned it could not also consume it. Cancel restores the committed
 *    design; commit makes the draft the new one.
 * 6. `useNBrandingEditor().setBranding` swaps the app name with no reload,
 *    which is what a branding settings page needs after an upload.
 */

interface Row {
  id: string;
  name: string;
  role: string;
}

const ROWS: Row[] = Array.from({ length: 42 }, (_, index) => ({
  id: String(index + 1),
  name: `Member ${String(index + 1).padStart(2, '0')}`,
  role: index % 3 === 0 ? 'Owner' : index % 3 === 1 ? 'Editor' : 'Viewer',
}));

/**
 * `theme.radius` is written straight into `--radius`, and every `--radius-*`
 * token is then set to `var(--radius)`. So it takes a CSS length — a token
 * *name* like "md" lands as `--radius: md`, which is invalid and squares off
 * the entire tree. `RADIUS_VALUE_MAP` is the other thing: per-component radius.
 */
const RADII = [
  { label: 'none', value: '0' },
  { label: 'sm', value: '0.25rem' },
  { label: 'md', value: '0.5rem' },
  { label: 'lg', value: '0.75rem' },
  { label: 'xl', value: '1.25rem' },
  { label: 'full', value: '9999px' },
] as const;

const columns: NTableColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
];

export default function UIProviderPage() {
  const { theme, setTheme } = useNajmTheme();
  const { timeZone } = useNajmTimeZone();
  const { language, changeLanguage } = useTranslation();
  const design = useNajmDesignEditor();
  const brandingEditor = useNBrandingEditor();
  const appName = useNBranding()?.appName;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{appName}</h1>
        <p className="text-muted-foreground text-sm">
          Language, theme, time zone, design and table defaults — one component
          in the root layout, and this app writes no provider file for any of
          it. Toggle either control and reload; both should come back the way
          you left them.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-4">
        <NButton
          onClick={() => void setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          Switch to {theme === 'dark' ? 'light' : 'dark'}
        </NButton>
        <NButton
          variant="outline"
          onClick={() => void changeLanguage(language === 'fr' ? 'en' : 'fr')}
        >
          Switch to {language === 'fr' ? 'English' : 'French'}
        </NButton>
        <NButton
          variant="outline"
          onClick={() =>
            brandingEditor?.setBranding({
              appName:
                appName === 'Najm Playground'
                  ? 'Renamed, no reload'
                  : 'Najm Playground',
            })
          }
        >
          Rename the app
        </NButton>
        <span className="text-muted-foreground text-sm">
          theme: <code>{theme}</code> · language: <code>{language}</code> · time
          zone: <code>{timeZone}</code>
        </span>
      </section>

      {design ? (
        <section className="border-border flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium">Design draft</h2>
            <span className="text-muted-foreground text-sm">
              {design.hasDraft ? 'editing' : 'committed'}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            Every control writes a draft the provider owns. The page — this
            card, the buttons, the table — restyles as you click, and this
            component sits <em>below</em> the design context it is driving.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {RADII.map(({ label, value }) => (
              <NButton
                key={label}
                size="sm"
                variant={
                  design.design.theme.radius === value ? 'default' : 'outline'
                }
                onClick={() => {
                  design.beginDraft();
                  design.setDraft({
                    ...design.design,
                    theme: { ...design.design.theme, radius: value },
                  });
                }}
              >
                {label}
              </NButton>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['compact', 'default', 'comfortable'] as const).map((scale) => (
              <NButton
                key={scale}
                size="sm"
                variant={
                  design.design.typography?.scale === scale
                    ? 'default'
                    : 'outline'
                }
                onClick={() => {
                  design.beginDraft();
                  design.setDraft({
                    ...design.design,
                    typography: { ...design.design.typography, scale },
                  });
                }}
              >
                {scale}
              </NButton>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NButton
              size="sm"
              variant="outline"
              disabled={!design.hasDraft}
              onClick={design.cancelDraft}
            >
              Cancel draft
            </NButton>
            <NButton
              size="sm"
              disabled={!design.hasDraft}
              onClick={() => design.setCommitted(design.design)}
            >
              Commit draft
            </NButton>
            <span className="text-muted-foreground text-sm">
              Cancel should snap back to the committed design; commit should
              leave the page as-is and clear the draft.
            </span>
          </div>
        </section>
      ) : null}

      <p className="text-muted-foreground text-sm">
        The pagination bar below should read{' '}
        <code>{language === 'fr' ? 'Lignes/page' : 'Rows/page'}</code>. Anything
        starting <code>common.pagination.</code> is a catalog field name that
        does not match the kit&apos;s.
      </p>

      {/*
        `dynamicHeight` defaults to true, which makes NTable measure its
        container and derive the page size from it. This page is an auto-height
        flex column, so there is nothing to measure and the page size collapses
        to a single row. A fixed page size is what a static demo wants anyway.
      */}
      <NTable
        columns={columns}
        data={ROWS}
        dynamicHeight={false}
        defaultPagination={{ pageIndex: 0, pageSize: 10 }}
        pageSizeOptions={[10, 20, 50]}
      />
    </main>
  );
}

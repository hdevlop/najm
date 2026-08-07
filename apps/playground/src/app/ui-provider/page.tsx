'use client';

import { useTranslation } from 'najm-i18n/react';
import {
  NButton,
  NTable,
  useNajmTheme,
  useNajmTimeZone,
  type NTableColumnDef,
} from 'najm-kit';

/**
 * Acceptance harness for `NajmAppProvider`.
 *
 * Nothing here mounts a provider and this app authors no provider file for any
 * of it — the whole stack is one component in the root layout. Four things are
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

const columns: NTableColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
];

export default function UIProviderPage() {
  const { theme, setTheme } = useNajmTheme();
  const { timeZone } = useNajmTimeZone();
  const { language, changeLanguage } = useTranslation();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">NajmAppProvider</h1>
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
        <span className="text-muted-foreground text-sm">
          theme: <code>{theme}</code> · language: <code>{language}</code> · time
          zone: <code>{timeZone}</code>
        </span>
      </section>

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

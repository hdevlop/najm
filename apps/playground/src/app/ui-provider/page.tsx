'use client';

import {
  NButton,
  NTable,
  useNajmTheme,
  useNajmTimeZone,
  type NTableColumnDef,
} from 'najm-kit';

/**
 * Acceptance harness for `NajmUIProvider`.
 *
 * Nothing here mounts a provider — the whole stack comes from `UIProvider` in
 * the root layout. Three things are being checked:
 *
 * 1. `useNajmTheme().setTheme` flips the class, POSTs `/api/ui-theme`, and
 *    survives a reload, which only works if the cookie round trip is real.
 * 2. `useNajmTimeZone()` reads through the same provider.
 * 3. The `NTable` below inherits its pagination labels from the provider's
 *    table defaults. This app passes no `t`, so the packaged English should
 *    render — a key string appearing in the pagination bar means the label
 *    derivation leaked when it should have stayed undefined.
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

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">NajmUIProvider</h1>
        <p className="text-muted-foreground text-sm">
          Theme, design context and table defaults, all from the kit. Toggle the
          theme and reload — it should come back the way you left it.
        </p>
      </header>

      <section className="flex items-center gap-4">
        <NButton
          onClick={() => void setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          Switch to {theme === 'dark' ? 'light' : 'dark'}
        </NButton>
        <span className="text-muted-foreground text-sm">
          theme: <code>{theme}</code> · time zone: <code>{timeZone}</code>
        </span>
      </section>

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

'use client';

import { useEffect, useMemo, useState } from 'react';
import { NButton, NTable, NTableDefaultsProvider, type NTableColumnDef, type NTableToolbarLabels } from 'najm-kit';

/**
 * The table chrome that only RTL and a non-English catalog can falsify.
 *
 * Three things to look at, each of which used to fail here:
 *
 * - **Card corners.** Turn RTL on and hover a card. The checkbox sits at the
 *   inline start and the actions menu at the inline end. They used to stack in
 *   the same corner, because the checkbox was pinned with a physical `left`
 *   while the actions used a logical `end`.
 * - **The settings menu.** Turn labels on. `View`, `Table`, `Cards` and
 *   `Columns` come from the catalog through `NTableDefaults.toolbarLabels`;
 *   they were hardcoded English before, unreachable by any translator. The
 *   check indicator and its row padding also follow the writing direction now.
 * - **The filter's `All` option.** Same bundle. Open the status filter in RTL
 *   with labels on.
 *
 * Labels here are supplied directly rather than through `NajmUIProvider`, so
 * the page shows the bundle itself. An application passes `t` to the provider
 * once and gets the same result for every table beneath it.
 *
 * The direction goes on `document.documentElement`, not on a wrapper div. Radix
 * portals the menu and the select content to `document.body`, so a `dir` set
 * further in leaves the popups LTR while the page around them flips — which is
 * not what a real application does, and would hide exactly the bug this page
 * exists to show.
 */

interface Person {
  id: string;
  name: string;
  email: string;
  status: string;
}

const STATUSES = ['active', 'inactive'];

const ROWS: Person[] = Array.from({ length: 12 }, (_, index) => ({
  id: String(index + 1),
  name: `Personne ${String(index + 1).padStart(2, '0')}`,
  email: `personne.${index + 1}@demo.najm.test`,
  status: STATUSES[index % STATUSES.length]!,
}));

const columns: NTableColumnDef<Person>[] = [
  { accessorKey: 'name', header: 'Nom' },
  { accessorKey: 'email', header: 'E-mail' },
  { accessorKey: 'status', header: 'Statut' },
];

/** What `buildToolbarLabels` would return for a French catalog. */
const FRENCH_TOOLBAR: NTableToolbarLabels = {
  settings: 'Réglages du tableau',
  view: 'Affichage',
  columns: 'Colonnes',
  modeTable: 'Tableau',
  modeCards: 'Cartes',
  modeJson: 'JSON',
  modeFiles: 'Fichiers',
  modeOption: (mode) => `Affichage ${mode}`,
  filters: 'Filtres',
  filterRegion: 'Filtres du tableau',
  allOption: 'Tous',
  create: 'Créer',
};

function PersonCard({ data }: { data: Person }) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <div aria-hidden className="h-24 rounded-md bg-muted" />
      <div className="text-sm font-medium text-foreground">{data.name}</div>
      <div className="truncate text-xs text-muted-foreground">{data.email}</div>
      <div className="text-xs text-primary">{data.status}</div>
    </div>
  );
}

export default function NTableRtlToolbarPage() {
  const [rtl, setRtl] = useState(true);
  const [french, setFrench] = useState(true);

  useEffect(() => {
    const previous = document.documentElement.dir;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    return () => {
      document.documentElement.dir = previous;
    };
  }, [rtl]);

  const defaults = useMemo(
    () => (french ? { toolbarLabels: FRENCH_TOOLBAR } : {}),
    [french],
  );

  const filters = useMemo(
    () => [
      { type: 'search', name: 'name', placeholder: french ? 'Rechercher un nom...' : 'Search name...' },
      {
        type: 'select',
        name: 'status',
        placeholder: french ? 'Filtrer par statut' : 'Filter by status',
        options: [
          { value: 'active', label: french ? 'Actif' : 'Active' },
          { value: 'inactive', label: french ? 'Inactif' : 'Inactive' },
        ],
      },
    ],
    [french],
  );

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-1" dir="ltr">
          <h1 className="text-xl font-semibold">NTable toolbar copy and RTL corners</h1>
          <p className="text-sm text-muted-foreground">
            Hover a card for the checkbox and the actions menu. Open the sliders
            control for the view and column headings.
          </p>
        </header>

        <section className="flex flex-wrap items-center gap-2" dir="ltr">
          <NButton variant={rtl ? 'default' : 'outline'} onClick={() => setRtl((value) => !value)}>
            {rtl ? 'RTL' : 'LTR'}
          </NButton>
          <NButton variant={french ? 'default' : 'outline'} onClick={() => setFrench((value) => !value)}>
            {french ? 'French labels' : 'Packaged English'}
          </NButton>
        </section>

        <NTableDefaultsProvider value={defaults}>
          <div className="h-[560px]">
            <NTable<Person>
              data={ROWS}
              columns={columns}
              filters={filters}
              renderCard={PersonCard}
              defaultMode="cards"
              availableModes={['cards', 'table']}
              showColumnVisibility
              showAddButton={false}
              onView={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
              classNames={{ cards: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' }}
            />
          </div>
        </NTableDefaultsProvider>
      </div>
    </div>
  );
}

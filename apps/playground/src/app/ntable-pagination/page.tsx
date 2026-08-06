'use client';

import { useMemo, useState } from 'react';
import { NButton, NTable, type NTableColumnDef } from 'najm-kit';

/**
 * Numbered page controls, against every case that decides how they render.
 *
 * The things to look at:
 *
 * - The bar does not change width as you page through a long result. Click
 *   through 1 → 20 and watch the slot count stay put while the gaps move.
 * - A gap never stands in for a single page. At 9 pages, page 4 shows
 *   "1 2 3 4 5 … 9" rather than spending a slot to hide page 2 alone.
 * - First and last are numbered buttons, so the double chevrons are gone.
 *   Compact restores them along with the "Page X of Y" text.
 * - "No page count" is the honest fallback: a server-paginated list that
 *   cannot report a real total gets the compact bar, not buttons for pages
 *   that may not exist.
 * - "hasNextPage" is the middle ground for that same list: numbers for the
 *   pages proven to exist and a trailing "…" for the rest. The gap is there on
 *   page one, so meeting page 3 on the way to page 2 reads as the result
 *   continuing rather than as the bar growing a button per click. Watch the
 *   slot count settle at eight instead of climbing.
 * - In RTL the row reverses and the chevrons mirror with it.
 * - Below `sm` the numbers give way to the position text — seven buttons plus
 *   the size select do not fit a phone.
 */

interface Person {
  id: string;
  name: string;
  email: string;
  city: string;
}

const CITIES = ['Casablanca', 'Rabat', 'Fès', 'Marrakech', 'Tanger', 'Agadir'];

function makeRows(count: number): Person[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1),
    name: `Person ${String(index + 1).padStart(3, '0')}`,
    email: `person.${String(index + 1).padStart(3, '0')}@demo.najm.test`,
    city: CITIES[index % CITIES.length]!,
  }));
}

const columns: NTableColumnDef<Person>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'city', header: 'City' },
];

const FRENCH_LABELS = {
  rowsPerPage: 'Lignes/page',
  pagination: 'Pagination des résultats',
  goToPage: (page: number) => `Aller à la page ${page}`,
  currentPage: (page: number) => `Page ${page}, page actuelle`,
  previousPage: 'Précédent',
  nextPage: 'Suivant',
  firstPage: 'Première page',
  lastPage: 'Dernière page',
  pageOf: (page: number, pageCount: number) => `Page ${page} sur ${pageCount}`,
  pageOfUnknown: (page: number) => `Page ${page}`,
  rowsSelected: (selected: number, total: number) =>
    `${selected} sur ${total} ligne(s) sélectionnée(s).`,
};

const TOTALS = [1, 3, 9, 40, 200];

/** What the pretend server tells NTable about the size of the result. */
type Knowledge = 'total' | 'hasNextPage' | 'bound' | 'none';

const KNOWLEDGE: { value: Knowledge; label: string; note: string }[] = [
  { value: 'total', label: 'real total', note: 'pageCount from a counted result — exact buttons.' },
  {
    value: 'hasNextPage',
    label: 'hasNextPage',
    note: 'No total. Numbers for the proven pages, “…” for the rest, no last-page jump.',
  },
  {
    value: 'bound',
    label: 'fake pageCount (bug)',
    note: 'pageCount = pageIndex + 2. The bar grows a button per click; check the console for the warning.',
  },
  { value: 'none', label: 'nothing', note: 'Neither prop — the numbered bar declines and compact takes over.' },
];

export default function NTablePaginationPage() {
  const [total, setTotal] = useState(200);
  const [variant, setVariant] = useState<'numbered' | 'compact'>('numbered');
  const [knowledge, setKnowledge] = useState<Knowledge>('total');
  const [rtl, setRtl] = useState(false);
  const [french, setFrench] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const allRows = useMemo(() => makeRows(total), [total]);
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));
  const safePageIndex = Math.min(pagination.pageIndex, pageCount - 1);
  const start = safePageIndex * pagination.pageSize;
  const rows = allRows.slice(start, start + pagination.pageSize);

  // What an endpoint reporting no total would still know: whether it managed to
  // read one row past the page it just served.
  const hasNextPage = start + rows.length < total;
  const suppliedPageCount = knowledge === 'total'
    ? pageCount
    : knowledge === 'bound'
      ? safePageIndex + (hasNextPage ? 2 : 1)
      : undefined;
  const active = KNOWLEDGE.find((entry) => entry.value === knowledge)!;

  return (
    <div className="min-h-screen bg-background p-6 text-foreground" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">NTable numbered pagination</h1>
          <p className="text-sm text-muted-foreground">
            Page {safePageIndex + 1} of {pageCount} · {total} rows · slot count holds
            steady across the whole result.
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{active.label}:</span> {active.note}
          </p>
        </header>

        <section className="flex flex-wrap items-center gap-2" dir="ltr">
          {TOTALS.map((count) => (
            <NButton
              key={count}
              variant={total === count ? 'default' : 'outline'}
              onClick={() => {
                setTotal(count);
                setPagination((current) => ({ ...current, pageIndex: 0 }));
              }}
            >
              {count} rows
            </NButton>
          ))}
          <span className="mx-2 h-6 w-px bg-border" />
          <NButton
            variant={variant === 'numbered' ? 'default' : 'outline'}
            onClick={() => setVariant('numbered')}
          >
            numbered
          </NButton>
          <NButton
            variant={variant === 'compact' ? 'default' : 'outline'}
            onClick={() => setVariant('compact')}
          >
            compact
          </NButton>
          <span className="mx-2 h-6 w-px bg-border" />
          {KNOWLEDGE.map((entry) => (
            <NButton
              key={entry.value}
              variant={knowledge === entry.value ? 'default' : 'outline'}
              onClick={() => setKnowledge(entry.value)}
            >
              {entry.label}
            </NButton>
          ))}
          <span className="mx-2 h-6 w-px bg-border" />
          <NButton variant={rtl ? 'default' : 'outline'} onClick={() => setRtl((value) => !value)}>
            RTL
          </NButton>
          <NButton
            variant={french ? 'default' : 'outline'}
            onClick={() => setFrench((value) => !value)}
          >
            FR labels
          </NButton>
        </section>

        <div style={{ height: 520 }}>
          <NTable
            data={rows}
            columns={columns}
            manualPagination
            pageCount={suppliedPageCount}
            hasNextPage={knowledge === 'hasNextPage' ? hasNextPage : undefined}
            rowCount={knowledge === 'total' ? total : undefined}
            pagination={{ ...pagination, pageIndex: safePageIndex }}
            onPaginationChange={setPagination}
            paginationVariant={variant}
            paginationLabels={french ? FRENCH_LABELS : undefined}
            pageSizeOptions={[10, 20, 50]}
            dynamicHeight={false}
            showAddButton={false}
            showViewToggle={false}
          />
        </div>
      </div>
    </div>
  );
}

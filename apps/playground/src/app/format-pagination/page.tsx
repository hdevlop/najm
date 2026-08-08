'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'najm-i18n/react';
import {
  Badge,
  NButton,
  NTable,
  buildCardPaginationLabels,
  createCardPagination,
  createOffsetPagination,
  fetchOffsetPage,
  formatCurrency,
  useNajmFormat,
  useNajmTimeZone,
  type NTableColumnDef,
  type OffsetPage,
  type OffsetPagination,
} from 'najm-kit';
import { useResponsiveOffsetList } from 'najm-kit/query';

/**
 * The formatting and offset-pagination layers, against the cases that decide
 * whether they were worth moving into the kit.
 *
 * What to look at:
 *
 * - **Nothing here reads the DOM.** `useNajmFormat` takes its time zone from
 *   `NajmPreferencesProvider` and its locale from the active `najm-i18n`
 *   language. Switch either control and every value below re-renders — the
 *   previous approach scraped `documentElement.dataset.timeZone` and could not
 *   react at all.
 * - **Minor units scale by currency, not by 100.** MAD, JPY and KWD are fed the
 *   same integer and land three decimal places apart.
 * - **The request log makes the probe row visible.** A page of 25 asks the
 *   server for 26 and discards the extra; at the 100-row ceiling there is no
 *   room for it, so continuation costs a second one-row lookahead instead.
 *   Switch to the endpoint that reports a total and both disappear.
 */

const TIME_ZONES = [
  'Africa/Casablanca',
  'Europe/Paris',
  'Asia/Tokyo',
  'America/New_York',
  'UTC',
];

const SAMPLE_INSTANT = '2026-08-08T20:00:00.000Z';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm text-foreground">{children}</span>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 mb-4 text-xs text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function FormatPanel() {
  const fmt = useNajmFormat();
  const { language, changeLanguage, languages } = useTranslation();
  const { timeZone, setTimeZone } = useNajmTimeZone();

  return (
    <Panel
      title="Formatting"
      description={`locale ${fmt.locale} · zone ${fmt.timeZone} · currency ${fmt.currency ?? 'none'}`}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {languages.map((code) => (
          <NButton
            key={code}
            size="sm"
            variant={code === language ? 'default' : 'outline'}
            onClick={() => void changeLanguage(code)}
          >
            {code}
          </NButton>
        ))}
        <select
          className="ml-auto rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          value={timeZone}
          onChange={(event) => void setTimeZone(event.target.value)}
        >
          {TIME_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </div>

      <Row label="money(125000) — minor units">{fmt.money(125_000)}</Row>
      <Row label="money(0)">{fmt.money(0)}</Row>
      <Row label="money(null) — placeholder">{fmt.money(null)}</Row>
      <Row label="money(12.5) — not an integer">{fmt.money(12.5)}</Row>
      <Row label="number(1234567.89)">{fmt.number(1_234_567.89)}</Row>
      <Row label="percent(0.4267, 1)">{fmt.percent(0.4267, 1)}</Row>
      <Row label={`date("${SAMPLE_INSTANT}")`}>{fmt.date(SAMPLE_INSTANT)}</Row>
      <Row label="dateTime(same instant)">{fmt.dateTime(SAMPLE_INSTANT)}</Row>
      <Row label="time(same instant)">{fmt.time(SAMPLE_INSTANT)}</Row>
      <Row label="relativeTime(3 days ago)">
        {fmt.relativeTime(Date.now() - 3 * 86_400_000)}
      </Row>
      <Row label='humanize("out_for_delivery")'>
        {fmt.humanize('out_for_delivery')}
      </Row>

      <p className="mt-4 mb-2 text-xs text-muted-foreground">
        The same integer, 1250 minor units, against three currency exponents:
      </p>
      <Row label="MAD (2 digits)">
        {formatCurrency(1250, { locale: fmt.locale, currency: 'MAD' })}
      </Row>
      <Row label="JPY (0 digits)">
        {formatCurrency(1250, { locale: fmt.locale, currency: 'JPY' })}
      </Row>
      <Row label="KWD (3 digits)">
        {formatCurrency(1250, { locale: fmt.locale, currency: 'KWD' })}
      </Row>
    </Panel>
  );
}

interface Person {
  id: number;
  name: string;
}

const TOTAL_ROWS = 213;

function PaginationPanel() {
  const [reportsTotal, setReportsTotal] = useState(true);
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [page, setPage] = useState<OffsetPage<Person> | null>(null);
  const [running, setRunning] = useState(false);

  // Stands in for a real endpoint. It records the window it was handed, which
  // is the only way to see the probe row from outside.
  const fetchPage = useCallback(
    async ({ limit, offset }: OffsetPagination) => {
      setLog((entries) => [
        ...entries,
        `GET /people?limit=${limit}&offset=${offset}`,
      ]);
      const rows: Person[] = Array.from(
        { length: Math.max(0, Math.min(limit, TOTAL_ROWS - offset)) },
        (_, index) => ({
          id: offset + index + 1,
          name: `Person ${String(offset + index + 1).padStart(3, '0')}`,
        }),
      );
      return reportsTotal ? { rows, total: TOTAL_ROWS } : rows;
    },
    [reportsTotal],
  );

  const load = useCallback(
    async (nextIndex: number) => {
      setRunning(true);
      setLog([]);
      try {
        const result = await fetchOffsetPage<Person>(
          fetchPage,
          createOffsetPagination(nextIndex, pageSize),
        );
        setPage(result);
        setPageIndex(nextIndex);
      } finally {
        setRunning(false);
      }
    },
    [fetchPage, pageSize],
  );

  return (
    <Panel
      title="Offset pagination"
      description={`A ${TOTAL_ROWS}-row result. Watch the request log change with the endpoint's shape and the page size.`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <NButton
          size="sm"
          variant={reportsTotal ? 'default' : 'outline'}
          onClick={() => {
            setReportsTotal(true);
            setPage(null);
            setLog([]);
          }}
        >
          reports total
        </NButton>
        <NButton
          size="sm"
          variant={reportsTotal ? 'outline' : 'default'}
          onClick={() => {
            setReportsTotal(false);
            setPage(null);
            setLog([]);
          }}
        >
          no total
        </NButton>
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(null);
            setLog([]);
          }}
        >
          {[10, 25, 100].map((size) => (
            <option key={size} value={size}>
              limit {size}
            </option>
          ))}
        </select>
        <NButton size="sm" disabled={running} onClick={() => void load(0)}>
          Load page 1
        </NButton>
        <NButton
          size="sm"
          variant="outline"
          disabled={running || !page?.hasNextPage}
          onClick={() => void load(pageIndex + 1)}
        >
          Next page
        </NButton>
      </div>

      {page && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge color="info">page {pageIndex + 1}</Badge>
          <Badge color="neutral">{page.rows.length} rows</Badge>
          <Badge color={page.hasNextPage ? 'success' : 'neutral'}>
            hasNextPage {String(page.hasNextPage)}
          </Badge>
          <Badge color="neutral">total {String(page.total)}</Badge>
          <Badge color="neutral">nextOffset {page.nextOffset}</Badge>
        </div>
      )}

      <div className="rounded-lg bg-muted/40 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Requests for this page
        </p>
        {log.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-1">
            {log.map((entry, index) => (
              <li key={index} className="font-mono text-xs text-foreground">
                {entry}
                {index === 0 && !reportsTotal && pageSize < 100 && (
                  <span className="ml-2 text-muted-foreground">
                    ← asked for one extra: the probe row
                  </span>
                )}
                {index === 1 && (
                  <span className="ml-2 text-muted-foreground">
                    ← lookahead: no room for a probe at the ceiling
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {page && page.rows.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          First row {page.rows[0]!.name} · last row{' '}
          {page.rows[page.rows.length - 1]!.name}
        </p>
      )}
    </Panel>
  );
}

function CardPaginationPanel() {
  const { t } = useTranslation();
  const labels = useMemo(() => buildCardPaginationLabels(t), [t]);

  const state = {
    hasNextPage: true,
    loadingMore: false,
    loadMoreError: new Error('network'),
    onLoadMore: () => undefined,
  };

  const modes = ['paged', 'infinite', 'all'] as const;

  return (
    <Panel
      title="createCardPagination"
      description="What NTable receives for each resolved mode. Only infinite carries continuation wiring, which is why the other two ignore the labels."
    >
      <div className="space-y-3">
        {modes.map((mode) => (
          <div key={mode}>
            <Badge color="info" className="mb-1">
              {mode}
            </Badge>
            <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 font-mono text-xs text-foreground">
              {JSON.stringify(
                createCardPagination({ ...state, mode }, labels),
                (_key, value) =>
                  typeof value === 'function' ? '[function]' : value,
                2,
              )}
            </pre>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        The error message comes from the catalog, not from the thrown Error — the
        raw value is only a flag, so an API envelope can be passed straight
        through without leaking its text into the UI.
      </p>
    </Panel>
  );
}

interface Order {
  id: number;
  reference: string;
  totalMinor: number;
  placedAt: string;
}

/** The whole stack live: query layer → NTable, with formatted cells. */
function LiveListPanel() {
  const fmt = useNajmFormat();
  const { t } = useTranslation();
  const labels = useMemo(() => buildCardPaginationLabels(t), [t]);

  const fetchPage = useCallback(
    async ({ limit, offset }: OffsetPagination) => {
      // A real endpoint would be an await away; the shape is what matters.
      await new Promise((resolve) => setTimeout(resolve, 250));
      const rows: Order[] = Array.from(
        { length: Math.max(0, Math.min(limit, TOTAL_ROWS - offset)) },
        (_, index) => {
          const id = offset + index + 1;
          return {
            id,
            reference: `ORD-${String(id).padStart(4, '0')}`,
            totalMinor: 12_500 + id * 337,
            placedAt: new Date(
              Date.UTC(2026, 7, 8, 20) - id * 43_200_000,
            ).toISOString(),
          };
        },
      );
      return { rows, total: TOTAL_ROWS };
    },
    [],
  );

  const list = useResponsiveOffsetList<Order>({
    fetchPage,
    queryKey: ['playground', 'orders'],
    strategy: 'paged',
  });

  const columns = useMemo<NTableColumnDef<Order>[]>(
    () => [
      { accessorKey: 'reference', header: 'Reference' },
      {
        accessorKey: 'totalMinor',
        header: 'Total',
        cell: ({ row }) => fmt.money(row.original.totalMinor),
      },
      {
        accessorKey: 'placedAt',
        header: 'Placed',
        cell: ({ row }) => fmt.date(row.original.placedAt),
      },
    ],
    [fmt],
  );

  return (
    <Panel
      title="useResponsiveOffsetList + NTable"
      description={`Live, from najm-kit/query. Resolved mode: ${list.mode}. Narrow the window below 1024px and it switches to scroll continuation on its own.`}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge color="info">mode {list.mode}</Badge>
        <Badge color="neutral">total {String(list.total)}</Badge>
        <Badge color="neutral">pageCount {list.pageCount}</Badge>
      </div>
      <NTable
        data={list.data}
        columns={columns}
        loading={list.loading}
        manualPagination
        pageCount={list.pageCount}
        pagination={list.pagination}
        onPaginationChange={list.onPaginationChange}
        cardPagination={createCardPagination(list, labels)}
      />
    </Panel>
  );
}

export default function FormatPaginationPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          najm-kit
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">
          Formatting &amp; offset pagination
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Lifted out of an application&apos;s <code>src/lib</code>. Both layers
          bind to providers the kit already owns.
        </p>
      </header>

      <div className="space-y-5">
        <FormatPanel />
        <PaginationPanel />
        <LiveListPanel />
        <CardPaginationPanel />
      </div>
    </main>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NButton, NTable, type NTableColumnDef } from 'najm-kit';

/**
 * Table mode under a server-paginated, container-measured setup.
 *
 * Mirrors how a real consumer drives NTable: `manualPagination` with a
 * controlled `pagination`, `dynamicHeight` so NTable measures the container and
 * reports the page size back, one buffered fetch, and a slow enough server that
 * the loading state is actually visible.
 *
 * The thing to watch on load is that nothing moves — the skeleton, the rows
 * that replace it, and the chrome around them are all the same size, and the
 * page size settles on one value rather than correcting itself a moment later.
 */

interface Assignment {
  id: string;
  sponsor: string;
  email: string;
  phone: string;
  family: string;
  status: string;
}

const FAMILIES = [
  'Ibtihal Bensaid',
  'Taoufik Otman Guessous',
  'Soukaina Nadia Zniber',
  'Hafid Aniba',
  'Karima Iraqi',
];

const FAKE_DB: Assignment[] = Array.from({ length: 60 }, (_, index) => ({
  id: String(index + 1),
  sponsor: `Sponsor ${String(index + 1).padStart(3, '0')}`,
  email: `sponsor.${String(index + 1).padStart(3, '0')}@demo.kafil.test`,
  phone: `+2126200000${String(index + 1).padStart(2, '0')}`,
  family: FAMILIES[index % FAMILIES.length]!,
  status: 'Active',
}));

const SERVER_LATENCY_MS = 500;
/** One buffered request; the display page is sliced out of it on the client. */
const WINDOW_SIZE = 50;

const columns: NTableColumnDef<Assignment>[] = [
  { accessorKey: 'sponsor', header: 'Sponsor' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'phone', header: 'Phone' },
  { accessorKey: 'family', header: 'Family' },
  { accessorKey: 'status', header: 'Status' },
];

export default function NTableTablePage() {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [fetches, setFetches] = useState(0);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetches((count) => count + 1);
    const timer = setTimeout(() => {
      if (cancelled) return;
      setRows(FAKE_DB.slice(0, WINDOW_SIZE));
      setLoading(false);
    }, SERVER_LATENCY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runId]);

  // Held in a ref as well as state so the callback resolves updates against the
  // current value rather than the one captured when it was created.
  const paginationRef = useRef(pagination);
  paginationRef.current = pagination;

  const onPaginationChange = useCallback((updater: unknown) => {
    const current = paginationRef.current;
    const next =
      typeof updater === 'function'
        ? (updater as (value: typeof current) => typeof current)(current)
        : (updater as typeof current);
    paginationRef.current = next;
    setPagination(next);
  }, []);

  const start = pagination.pageIndex * pagination.pageSize;
  const pageRows = rows.slice(start, start + pagination.pageSize);
  const pageCount = Math.max(1, Math.ceil(rows.length / pagination.pageSize));

  return (
    <div className="flex h-screen flex-col gap-4 p-6">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Support assignments</h1>
          <p className="text-sm text-muted-foreground">
            Server-paginated, sized to its container — {rows.length} loaded, showing{' '}
            {pagination.pageSize} per page
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            requests: <strong className="text-foreground">{fetches}</strong>
          </span>
          <NButton
            onClick={() => {
              setFetches(0);
              setRows([]);
              setPagination({ pageIndex: 0, pageSize: 25 });
              paginationRef.current = { pageIndex: 0, pageSize: 25 };
              setRunId((id) => id + 1);
            }}
          >
            Reload
          </NButton>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <NTable<Assignment>
          data={pageRows}
          columns={columns}
          loading={loading}
          bordered
          dynamicHeight
          manualPagination
          pagination={pagination}
          pageCount={pageCount}
          onPaginationChange={onPaginationChange}
          onCreate={() => {}}
          defaultMode="table"
        />
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NButton, NTable, type NTableColumnDef } from 'najm-kit';

/**
 * Reproduction harness for server-paginated NTable page sizing.
 *
 * A consumer that owns fetching refetches every time NTable reports a page
 * size, so each extra report is a wasted request and a visible skeleton. This
 * page recreates the exact conditions that made it report four times for one
 * visit: manual pagination, dynamic height, a card grid, a slow "server", and
 * cards that grow taller shortly after mount the way real ones do once their
 * images decode.
 *
 * Watch the counter. One fetch after the list settles is correct. More than one
 * means the measurement is feeding back into itself again.
 */

interface Product {
  id: string;
  name: string;
  price: string;
  category: string;
}

const CATEGORIES = ['Fresh Produce', 'School Supplies', 'Beverages', 'Baby Products', 'Dairy'];

const FAKE_DB: Product[] = Array.from({ length: 60 }, (_, index) => ({
  id: String(index + 1),
  name: `Demo product ${index + 1}`,
  price: `MAD ${(index % 40) * 5 + 5}.00`,
  category: CATEGORIES[index % CATEGORIES.length]!,
}));

const SERVER_LATENCY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Stands in for the real catalog endpoint, including its page-size clamp. */
async function fetchProducts({ limit, offset }: { limit: number; offset: number }) {
  await sleep(SERVER_LATENCY_MS);
  const safeLimit = Math.min(100, Math.max(1, limit));
  return {
    rows: FAKE_DB.slice(offset, offset + safeLimit),
    total: FAKE_DB.length,
  };
}

const columns: NTableColumnDef<Product>[] = [
  { accessorKey: 'name', header: 'Product' },
  { accessorKey: 'price', header: 'Price' },
  { accessorKey: 'category', header: 'Category' },
];

/**
 * Grows shortly after mount. A real product card does the same thing when its
 * image finishes decoding, which is what nudged the measured card height and
 * triggered a second page-size report.
 */
function ProductCard({ data }: { data: Product }) {
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setImageReady(true), 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div
        aria-hidden
        className="rounded-md bg-muted transition-all duration-200"
        style={{ height: imageReady ? 132 : 56 }}
      />
      <div className="text-sm font-medium text-foreground">{data.name}</div>
      <div className="text-sm font-semibold text-primary">{data.price}</div>
      <div className="text-xs text-muted-foreground">{data.category}</div>
    </div>
  );
}

export default function NTablePagingDemoPage() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [rows, setRows] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const [mountKey, setMountKey] = useState(0);
  const startedAt = useRef(Date.now());
  const fetchCount = useRef(0);

  const append = useCallback((line: string) => {
    setLog((current) => [...current, `+${Date.now() - startedAt.current}ms  ${line}`]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCount.current += 1;
    const attempt = fetchCount.current;
    append(`FETCH #${attempt}  limit=${pagination.pageSize} offset=${pagination.pageIndex * pagination.pageSize}`);
    setLoading(true);
    fetchProducts({
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    }).then((page) => {
      if (cancelled) return;
      setRows(page.rows);
      setTotal(page.total);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [pagination.pageIndex, pagination.pageSize, append]);

  const onPaginationChange = useCallback((next: { pageIndex: number; pageSize: number }) => {
    append(`NTable reported pageSize=${next.pageSize} pageIndex=${next.pageIndex}`);
    setPagination(next);
  }, [append]);

  const reset = () => {
    startedAt.current = Date.now();
    fetchCount.current = 0;
    setLog([]);
    setRows([]);
    setLoading(true);
    setPagination({ pageIndex: 0, pageSize: 25 });
    setMountKey((key) => key + 1);
  };

  const reportCount = log.filter((line) => line.includes('NTable reported')).length;
  const fetchTotal = log.filter((line) => line.includes('FETCH #')).length;

  return (
    <div className="flex h-screen flex-col gap-3 bg-background p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">NTable server pagination — page-size stability</h1>
          <p className="text-sm text-muted-foreground">
            {SERVER_LATENCY_MS}ms fake server, 60 rows, cards grow at 700ms to imitate image decode.
          </p>
        </div>
        <div className="ms-auto flex items-center gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground">server fetches </span>
            <span className={fetchTotal > 2 ? 'font-bold text-destructive' : 'font-bold text-primary'}>
              {fetchTotal}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">page-size reports </span>
            <span className={reportCount > 1 ? 'font-bold text-destructive' : 'font-bold text-primary'}>
              {reportCount}
            </span>
          </div>
          <NButton variant="outline" onClick={reset}>Re-run</NButton>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-3">
        <div className="min-h-0" data-demo-loading={String(loading)} data-demo-rows={rows.length}>
          <NTable<Product>
            key={mountKey}
            data={rows}
            columns={columns}
            renderCard={ProductCard}
            defaultMode="cards"
            availableModes={['cards', 'table']}
            dynamicHeight
            manualPagination
            loading={loading}
            pagination={pagination}
            pageCount={Math.max(1, Math.ceil(total / pagination.pageSize))}
            onPaginationChange={onPaginationChange}
            pageSizeOptions={[10, 16, 24, 25, 50]}
            showCheckbox={false}
            showAddButton={false}
            classNames={{ cards: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6' }}
          />
        </div>

        <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-sm font-medium text-foreground">Event log</div>
          <div className="min-h-0 flex-1 overflow-auto font-mono text-xs leading-relaxed">
            {log.length === 0
              ? <div className="text-muted-foreground">waiting…</div>
              : log.map((line, index) => (
                  <div
                    key={index}
                    className={line.includes('reported') ? 'text-amber-500' : 'text-muted-foreground'}
                  >
                    {line}
                  </div>
                ))}
          </div>
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
            Expect one initial fetch, then at most one page-size report and its refetch.
            A third or fourth fetch means the measurement is oscillating.
          </p>
        </div>
      </div>
    </div>
  );
}

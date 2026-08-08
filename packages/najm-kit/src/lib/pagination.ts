/**
 * The offset-pagination protocol behind `NTable`'s page controls.
 *
 * The kit already owns the consuming half — `useDynamicPageSize` measures how
 * many rows fit, `buildPageItems` renders the bar. This is the fetching half:
 * how one page is requested, and how "is there another one" is answered when
 * the endpoint does not say.
 *
 * Pure, framework-agnostic, and usable on the server. Nothing here knows about
 * react-query.
 */

/** A page response from an endpoint that reports a result total. */
export interface ApiPage<T> {
  rows: T[];
  /** Rows matching the query on the server, or `null` if the endpoint is silent. */
  total: number | null;
}

export interface OffsetPagination {
  limit: number;
  offset: number;
}

export interface OffsetPage<T> {
  rows: T[];
  hasNextPage: boolean;
  nextOffset: number;
  /** How many rows match in total, or `null` if the endpoint does not say. */
  total: number | null;
}

/**
 * Fetches one window.
 *
 * The bare-array return is not a legacy concession to delete later: plenty of
 * endpoints have no cheap way to count, and `COUNT(*)` over a filtered join is
 * exactly the query worth avoiding. Both shapes are first-class.
 */
export type OffsetPageFetcher<T> = (
  pagination: OffsetPagination,
) => Promise<ApiPage<T> | T[]>;

export const DEFAULT_PAGE_SIZE = 25;

/**
 * The largest `limit` a server will honour. Requests are clamped to it, and it
 * is the ceiling the probe row cannot exceed — see `fetchOffsetPage`.
 */
export const DEFAULT_MAX_PAGE_SIZE = 100;

export interface OffsetPageOptions {
  /** Defaults to `DEFAULT_MAX_PAGE_SIZE`. Match your server's clamp. */
  maxLimit?: number;
}

function toApiPage<T>(result: ApiPage<T> | T[]): ApiPage<T> {
  return Array.isArray(result) ? { rows: result, total: null } : result;
}

export function createOffsetPagination(
  pageIndex = 0,
  pageSize = DEFAULT_PAGE_SIZE,
  { maxLimit = DEFAULT_MAX_PAGE_SIZE }: OffsetPageOptions = {},
): OffsetPagination {
  const safePageIndex = Math.max(0, Math.trunc(pageIndex));
  const safePageSize = Math.min(maxLimit, Math.max(1, Math.trunc(pageSize)));

  return { limit: safePageSize, offset: safePageIndex * safePageSize };
}

export function getPageIndex({ limit, offset }: OffsetPagination): number {
  return Math.floor(Math.max(0, offset) / Math.max(1, limit));
}

/**
 * Fetches one page and answers whether another follows.
 *
 * Two strategies, chosen by what the endpoint returns:
 *
 * - **With a total**, continuation is arithmetic — no extra rows, no extra
 *   request.
 * - **Without one**, the request carries a *probe row*: it asks for `limit + 1`
 *   and reports a next page when that extra row comes back. The probe is
 *   discarded before returning, so callers always receive at most `limit` rows.
 *
 * Whether an endpoint reports a total is only knowable from its response, so
 * the probe row rides along on the first request either way. The one case the
 * probe cannot cover is a request already at `maxLimit`, where there is no room
 * to ask for one more; continuation then costs a second single-row lookahead.
 * That is the case a result total exists to avoid, and why the endpoints
 * backing numbered pages should report one.
 */
export async function fetchOffsetPage<T>(
  fetchPage: OffsetPageFetcher<T>,
  pagination: OffsetPagination,
  { maxLimit = DEFAULT_MAX_PAGE_SIZE }: OffsetPageOptions = {},
): Promise<OffsetPage<T>> {
  const requestedLimit = Math.min(maxLimit, Math.max(1, pagination.limit));
  const probeLimit =
    requestedLimit < maxLimit ? requestedLimit + 1 : requestedLimit;

  const page = toApiPage(
    await fetchPage({ limit: probeLimit, offset: pagination.offset }),
  );
  const rows = page.rows.slice(0, requestedLimit);
  const nextOffset = pagination.offset + rows.length;

  if (page.total !== null) {
    return {
      rows,
      hasNextPage: nextOffset < page.total,
      nextOffset,
      total: page.total,
    };
  }

  const hasNextPage =
    page.rows.length > requestedLimit ||
    (probeLimit === requestedLimit &&
      page.rows.length === requestedLimit &&
      toApiPage(await fetchPage({ limit: 1, offset: nextOffset })).rows.length >
        0);

  return { rows, hasNextPage, nextOffset, total: null };
}

export type QueryValue = string | number | boolean | null | undefined;

/**
 * Drops empty entries from a query object, so an untouched filter contributes
 * no parameter at all rather than `?status=`.
 *
 * `false` and `0` are kept — both are meaningful filter values, and dropping
 * them is the bug this exists to prevent.
 */
export function cleanQuery(
  query: Record<string, QueryValue>,
): Record<string, QueryValue> {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );
}

export interface UnmatchedQueryRow {
  id: string;
  query: string;
  normalized: string;
  score: string | number;
  threshold: string | number;
  source: string | null;
  nearestTool?: string | null;
  occurrenceCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** One routing miss, as the router reports it to the inbox. */
export interface UnmatchedMiss {
  query: string;
  normalized: string;
  score: number;
  threshold: number;
  source?: string;
  /** The tool behind `score`, the closest below the threshold. */
  nearestTool?: string | null;
}

export interface UnmatchedQueryResponse {
  id: string;
  query: string;
  normalized: string;
  /**
   * What routing embeds for `normalized` with the current
   * `rewriteRoutingQuery`; null when there is no rewrite or it fails.
   */
  canonical: string | null;
  score: number;
  threshold: number;
  source: string | null;
  /** Closest tool below the threshold; null for entries recorded by earlier releases. */
  nearestTool: string | null;
  occurrenceCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

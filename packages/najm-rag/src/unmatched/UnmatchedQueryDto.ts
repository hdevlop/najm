export interface UnmatchedQueryRow {
  id: string;
  query: string;
  normalized: string;
  score: string | number;
  threshold: string | number;
  source: string | null;
  occurrenceCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UnmatchedQueryResponse {
  id: string;
  query: string;
  normalized: string;
  score: number;
  threshold: number;
  source: string | null;
  occurrenceCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

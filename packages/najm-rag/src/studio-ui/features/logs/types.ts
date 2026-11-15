// owner: logs (used by settings for display, app/ for workspace routing)

// Audit log domain type
export interface AuditLogEntry {
  id: string;
  action: string;
  userId: string | null;
  details: string;
  createdAt: string;
}

// Unmatched queries from the routing inbox
export interface UnmatchedQuery {
  id: string;
  query: string;
  normalized: string;
  /** What routing embeds after the app's rewrite; null without a rewrite. */
  canonical?: string | null;
  score: number;
  threshold: number;
  source: string | null;
  /** Closest tool below the threshold; null for older entries. */
  nearestTool?: string | null;
  occurrenceCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

// Cross-feature re-exports
export type { LiveRoutingSettings, IndexSettings, JsonViewColors } from '../routing-tools/types';
export type { MCPTool } from '../routing-tools/types';

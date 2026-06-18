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
  score: number;
  threshold: number;
  source: string | null;
  occurrenceCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

// Cross-feature re-exports
export type { LiveRoutingSettings, IndexSettings, JsonViewColors } from '../routing-tools/types';
export type { MCPTool } from '../routing-tools/types';

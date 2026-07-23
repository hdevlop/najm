export type UsageCategory = { category: string; count: number; bytes: number };

export interface DashboardViewProps {
  searchRef?: React.Ref<HTMLInputElement>;
}

export interface NamespaceItem {
  name: string;
  fileCount: number;
  totalBytes: number;
  isPrivate?: boolean;
}

export interface NamespaceBreakdownProps {
  namespaces: NamespaceItem[];
  totalQuota?: number;
}

export interface ActivityRow {
  id: number | string;
  action: string;
  namespace: string;
  path?: string;
  ts: string;
}

export interface RecentActivityTableProps {
  rows: ActivityRow[];
  loading?: boolean;
  error?: string | null;
}

export interface StorageOverviewCardProps {
  totalBytes: number;
  totalCount: number;
  categories: UsageCategory[];
}

export interface UsageSummary {
  totalBytes: number;
  totalCount: number;
  categories: UsageCategory[];
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  namespace: string;
  path?: string;
  meta?: Record<string, unknown>;
  ts: string;
}

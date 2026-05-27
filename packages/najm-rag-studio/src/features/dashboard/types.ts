import type { Workspace } from '@/shared/hooks/useWorkspace';

export interface DashboardProps {
  onNavigate: (workspace: Workspace) => void;
}

export type { Workspace } from '@/shared/hooks/useWorkspace';
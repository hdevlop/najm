export { StorageStudioProvider } from './providers';
export { StorageStudio } from './app/studio';
export type { StorageStudioProps, StorageStudioProviderProps } from './providers/types';

// Panels
export { DashboardView } from './features/dashboard';
export { TrashView } from './features/trash';
export { ExplorerView } from './features/explorer';
export { SharedLinksView } from './features/shared';

// Dashboard components
export { StorageOverviewCard } from './features/dashboard/components/StorageOverviewCard';
export { RecentActivityTable } from './features/dashboard/components/RecentActivityTable';
export { NamespaceBreakdown } from './features/dashboard/components/NamespaceBreakdown';
export { NEmptyState as EmptyState, NLoadingState as LoadingState, NErrorState as ErrorState } from 'najm-kit';

// Hooks
export { useUsage } from './features/dashboard/hooks/useUsage';
export { useActivity } from './features/dashboard/hooks/useActivity';
export { useTrash } from './features/trash/hooks/useTrash';
export { useKeyboard } from './shared/hooks/useKeyboard';

// Phase 6
export { PresignModal } from './features/presign/components/PresignModal';

// Phase 8
export { CommandPalette } from './features/command/components/CommandPalette';

// Tags
export { TagEditorSheet } from './features/tags/components/TagEditorSheet';
export { TagsView } from './features/tags/components/TagsView';
export { useTags } from './features/tags/hooks/useTags';
export { useFileTags } from './features/tags/hooks/useFileTags';
export { useTagCapabilities } from './features/tags/hooks/useTagCapabilities';
export { useFilesByTag } from './features/tags/hooks/useFilesByTag';

// Dashboard types
export type { StorageOverviewCardProps } from './features/dashboard/types';
export type { ActivityRow, RecentActivityTableProps } from './features/dashboard/types';
export type { NamespaceItem, NamespaceBreakdownProps } from './features/dashboard/types';

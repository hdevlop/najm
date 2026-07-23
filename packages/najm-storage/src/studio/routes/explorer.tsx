import React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { ExplorerView } from '@/features/explorer';

export const explorerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explorer',
  validateSearch: (search: Record<string, unknown>) => ({
    bucket: (search.bucket as string) || '',
    prefix: (search.prefix as string) || '',
    view: (search.view as 'list' | 'grid') || 'grid',
  }),
  component: ExplorerRoute,
});

function ExplorerRoute() {
  const { bucket, prefix, view } = explorerRoute.useSearch();
  const navigate = useNavigate();

  if (!bucket) {
    return (
      <div className="flex h-full items-center justify-center text-txt-muted text-sm">
        Select a bucket to explore
      </div>
    );
  }

  return (
    <ExplorerView
      key={bucket}
      bucket={bucket}
      view={view}
      onViewChange={(nextView) => {
        navigate({ search: (prev: any) => ({ ...prev, view: nextView }), replace: true });
      }}
      prefix={prefix}
      onPrefixChange={(nextPrefix) => {
        navigate({ search: (prev: any) => ({ ...prev, prefix: nextPrefix }) });
      }}
    />
  );
}

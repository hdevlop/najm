import React, { useCallback } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { useRouteCallbacks } from './__root';
import { TestsView } from '@/features/routing-tests';

export const testsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tests',
  validateSearch: (search: Record<string, unknown>) => ({
    view: (search.view as 'table' | 'json' | 'files') || undefined,
  }),
  component: TestsRoute,
});

function TestsRoute() {
  const { onViewContextChange, resetNonce } = useRouteCallbacks();
  const { view } = testsRoute.useSearch();
  const navigate = useNavigate();

  const handleSearchStateChange = useCallback((state: { view?: string; group?: string; lang?: string }) => {
    navigate({ search: (prev: any) => ({ ...prev, ...state }), replace: true });
  }, [navigate]);

  return (
    <TestsView
      onViewContextChange={onViewContextChange}
      resetNonce={resetNonce}
      initialView={view}
      onSearchStateChange={handleSearchStateChange}
    />
  );
}

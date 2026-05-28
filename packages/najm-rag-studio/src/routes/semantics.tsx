import React, { useCallback } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { useRouteCallbacks } from './__root';
import { SemanticsView } from '@/features/routing-semantics';

export const semanticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/semantics',
  validateSearch: (search: Record<string, unknown>) => ({
    view: (search.view as 'table' | 'json' | 'files') || undefined,
    group: (search.group as string) || undefined,
    lang: (search.lang as string) || undefined,
  }),
  component: SemanticsRoute,
});

function SemanticsRoute() {
  const { onViewContextChange, resetNonce } = useRouteCallbacks();
  const { view, group, lang } = semanticsRoute.useSearch();
  const navigate = useNavigate();

  const handleSearchStateChange = useCallback((state: { view?: string; group?: string; lang?: string }) => {
    navigate({ search: (prev: any) => ({ ...prev, ...state }), replace: true });
  }, [navigate]);

  return (
    <SemanticsView
      onViewContextChange={onViewContextChange}
      resetNonce={resetNonce}
      initialView={view}
      initialGroup={group}
      initialLang={lang}
      onSearchStateChange={handleSearchStateChange}
    />
  );
}

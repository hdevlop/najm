import React from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { useRouteCallbacks } from './__root';
import { ToolsView } from '@/features/routing-tools';

export const toolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tools',
  component: ToolsRoute,
});

function ToolsRoute() {
  const { onViewContextChange } = useRouteCallbacks();
  return <ToolsView onViewContextChange={onViewContextChange} />;
}

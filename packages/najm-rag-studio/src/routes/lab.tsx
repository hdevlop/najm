import React from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { useRouteCallbacks } from './__root';
import { LabView } from '@/features/routing-lab';

export const labRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lab',
  component: LabRoute,
});

function LabRoute() {
  const { onViewContextChange } = useRouteCallbacks();
  return <LabView onViewContextChange={onViewContextChange} />;
}

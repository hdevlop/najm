import React from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { TrashView } from '@/features/trash';

export const trashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trash',
  component: TrashRoute,
});

function TrashRoute() {
  return <TrashView />;
}

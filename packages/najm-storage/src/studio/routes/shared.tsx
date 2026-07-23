import React from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { SharedLinksView } from '@/features/shared';

export const sharedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/shared',
  component: SharedRoute,
});

function SharedRoute() {
  return <SharedLinksView />;
}

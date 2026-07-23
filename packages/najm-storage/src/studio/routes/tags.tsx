import React from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { TagsView } from '@/features/tags/components/TagsView';

export const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tags',
  component: TagsRoute,
});

function TagsRoute() {
  return <TagsView />;
}

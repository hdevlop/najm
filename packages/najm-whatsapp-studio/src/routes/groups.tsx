import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { GroupsView } from '@/features/groups';

export const groupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups',
  component: GroupsView,
});

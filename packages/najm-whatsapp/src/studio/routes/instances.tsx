import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { InstancesView } from '@/features/instances';

export const instancesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/instances',
  component: InstancesView,
});

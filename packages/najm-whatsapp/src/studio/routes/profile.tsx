import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { ProfileView } from '@/features/profile';

export const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfileView,
});

import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { SettingsView } from '@/features/settings';

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsView,
});

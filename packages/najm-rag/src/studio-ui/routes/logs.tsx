import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { LogsWorkspace } from '@/features/logs';

export const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs',
  component: LogsWorkspace,
});

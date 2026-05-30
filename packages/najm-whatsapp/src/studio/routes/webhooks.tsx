import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { WebhooksView } from '@/features/webhooks';

export const webhooksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/webhooks',
  component: WebhooksView,
});

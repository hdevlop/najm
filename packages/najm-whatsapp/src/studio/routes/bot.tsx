import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { BotView } from '@/features/bot';

export const botRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bot',
  component: BotView,
});

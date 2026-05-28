import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree';
import type { StudioRouterContext } from './__root';

export function createStudioRouter(basePath: string, context: StudioRouterContext) {
  return createRouter({
    routeTree,
    basepath: basePath || '/',
    context,
  });
}

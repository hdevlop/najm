import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree';
import type { StudioRouterContext } from './__root';

export function createStudioRouter(basePath: string, context: StudioRouterContext) {
  const normalizedBasePath = basePath || '/';

  return createRouter({
    routeTree,
    basepath: normalizedBasePath,
    context,
    ...(typeof document === 'undefined'
      ? { history: createMemoryHistory({ initialEntries: [normalizedBasePath] }) }
      : {}),
  });
}

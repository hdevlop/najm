import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree';
import { createStudioHistory } from './history';
import type { StudioRouterContext } from './__root';

export function createStudioRouter(basePath: string, context: StudioRouterContext) {
  const normalizedBasePath = basePath || '/';

  return createRouter({
    routeTree,
    basepath: normalizedBasePath,
    context,
    history: typeof document === 'undefined'
      ? createMemoryHistory({ initialEntries: [normalizedBasePath] })
      : createStudioHistory(),
  });
}

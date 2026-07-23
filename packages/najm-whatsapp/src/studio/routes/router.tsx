import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree';

export function createStudioRouter(basePath: string) {
  const normalizedBasePath = basePath || '/';

  return createRouter({
    routeTree,
    basepath: normalizedBasePath,
    ...(typeof document === 'undefined'
      ? { history: createMemoryHistory({ initialEntries: [normalizedBasePath] }) }
      : {}),
  } as any);
}

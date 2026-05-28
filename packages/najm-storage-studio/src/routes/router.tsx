import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree';

export function createStudioRouter(basePath: string) {
  return createRouter({
    routeTree,
    basepath: basePath || '/',
  });
}

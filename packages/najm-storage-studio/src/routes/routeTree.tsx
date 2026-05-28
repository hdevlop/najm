import { rootRoute } from './__root';
import { indexRoute } from './index';
import { explorerRoute } from './explorer';

export const routeTree = rootRoute.addChildren([
  indexRoute,
  explorerRoute,
]);

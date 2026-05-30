import { rootRoute } from './__root';
import { indexRoute } from './index';
import { explorerRoute } from './explorer';
import { trashRoute } from './trash';
import { sharedRoute } from './shared';
import { tagsRoute } from './tags';

export const routeTree = rootRoute.addChildren([
  indexRoute,
  explorerRoute,
  trashRoute,
  sharedRoute,
  tagsRoute,
]);

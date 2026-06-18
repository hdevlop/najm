import { redirect, createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';

export const storageSemanticsRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: '/storage/semantics',
  beforeLoad: () => {
    throw redirect({ href: '/semantics?view=files' });
  },
});

export const storageTestsRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: '/storage/tests',
  beforeLoad: () => {
    throw redirect({ href: '/tests?view=files' });
  },
});

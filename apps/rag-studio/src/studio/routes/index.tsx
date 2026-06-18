import React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { NAV_ID_TO_PATH } from './__root';
import { Dashboard } from '@/features/dashboard';

const WORKSPACE_TO_PATH: Record<string, string> = {
  ...NAV_ID_TO_PATH,
  'storage-semantics': '/semantics',
  'storage-tests': '/tests',
};

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexRoute,
});

function IndexRoute() {
  const navigate = useNavigate();
  return <Dashboard onNavigate={(w) => navigate({ to: WORKSPACE_TO_PATH[w] ?? '/' })} />;
}

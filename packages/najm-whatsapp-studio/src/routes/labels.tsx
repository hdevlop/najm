import React from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { LabelsView } from '@/features/labels';

export const labelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/labels',
  validateSearch: (search: Record<string, unknown>) => ({
    jid: search.jid ? String(search.jid) : undefined,
  }),
  component: LabelsRoute,
});

function LabelsRoute() {
  const { jid } = labelsRoute.useSearch();
  return <LabelsView jid={jid ?? null} />;
}

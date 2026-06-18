import React from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { UnmatchedInbox } from '@/features/logs';
import { useUnmatchedInbox } from '@/features/logs/hooks/useUnmatchedInbox';

export const unmatchedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/unmatched',
  component: UnmatchedRoute,
});

function UnmatchedRoute() {
  const { unmatchedItems, unmatchedTools, unmatchedLoading, loadUnmatchedInbox, mapUnmatched, discardUnmatched } = useUnmatchedInbox({ enabled: true });

  return (
    <UnmatchedInbox
      items={unmatchedItems}
      tools={unmatchedTools}
      loading={unmatchedLoading}
      onRefresh={loadUnmatchedInbox}
      onMap={mapUnmatched}
      onDiscard={discardUnmatched}
    />
  );
}

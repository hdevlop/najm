import React from 'react';
import { createRoute, redirect } from '@tanstack/react-router';
import { rootRoute } from '../__root';
import { useRouteCallbacks } from '../__root';
import { KnowledgeWorkspace } from '@/features/knowledge';

export const knowledgeChunksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/knowledge/chunks',
  beforeLoad: ({ context }) => {
    if (!context.enableKnowledge) throw redirect({ to: '/lab' });
  },
  component: KnowledgeChunksRoute,
});

function KnowledgeChunksRoute() {
  const { onCitationClick, onViewContextChange } = useRouteCallbacks();
  return (
    <KnowledgeWorkspace
      view="chunks"
      onCitationClick={onCitationClick}
      onViewContextChange={onViewContextChange}
    />
  );
}

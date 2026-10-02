import React from 'react';
import { createRoute, redirect } from '@tanstack/react-router';
import { rootRoute } from '../__root';
import { useRouteCallbacks } from '../__root';
import { KnowledgeWorkspace } from '@/features/knowledge';

export const knowledgeDocumentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/knowledge/documents',
  beforeLoad: ({ context }) => {
    if (!context.enableKnowledge) throw redirect({ to: '/lab' });
  },
  component: KnowledgeDocumentsRoute,
});

function KnowledgeDocumentsRoute() {
  const { onCitationClick, onViewContextChange } = useRouteCallbacks();
  return (
    <KnowledgeWorkspace
      view="documents"
      onCitationClick={onCitationClick}
      onViewContextChange={onViewContextChange}
    />
  );
}

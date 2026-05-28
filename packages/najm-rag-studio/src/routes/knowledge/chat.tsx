import React from 'react';
import { createRoute, redirect } from '@tanstack/react-router';
import { rootRoute } from '../__root';
import { useRouteCallbacks } from '../__root';
import { KnowledgeWorkspace } from '@/features/knowledge';

export const knowledgeChatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/knowledge/chat',
  beforeLoad: ({ context }) => {
    if (!context.enableKnowledge) throw redirect({ to: '/lab' });
  },
  component: KnowledgeChatRoute,
});

function KnowledgeChatRoute() {
  const { onCitationClick, onViewContextChange } = useRouteCallbacks();
  return (
    <KnowledgeWorkspace
      view="chat"
      onCitationClick={onCitationClick}
      onViewContextChange={onViewContextChange}
    />
  );
}

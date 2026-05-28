import React from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { ChatOpsView } from '@/features/chat-ops';

export const chatOpsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat-ops',
  validateSearch: (search: Record<string, unknown>) => ({
    jid: search.jid ? String(search.jid) : undefined,
  }),
  component: ChatOpsRoute,
});

function ChatOpsRoute() {
  const { jid } = chatOpsRoute.useSearch();
  return <ChatOpsView jid={jid ?? null} />;
}

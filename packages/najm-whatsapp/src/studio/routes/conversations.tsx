import React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { ConversationsView } from '@/features/conversations';

export const conversationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conversations',
  validateSearch: (search: Record<string, unknown>) => ({
    jid: search.jid ? String(search.jid) : undefined,
  }),
  component: ConversationsRoute,
});

function ConversationsRoute() {
  const { jid } = conversationsRoute.useSearch();
  const navigate = useNavigate();

  return (
    <ConversationsView
      selectedJid={jid ?? null}
      onSelectConversation={(newJid) =>
        navigate({ search: { jid: newJid ?? undefined } as any })
      }
    />
  );
}

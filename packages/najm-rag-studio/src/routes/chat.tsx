import React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { NAV_ID_TO_PATH, useRouteCallbacks } from './__root';
import { StudioChat } from '@/features/chat';

export const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  component: ChatRoute,
});

function ChatRoute() {
  const navigate = useNavigate();
  const { openSettings } = useRouteCallbacks();
  return (
    <StudioChat
      onNavigate={(w) => navigate({ to: NAV_ID_TO_PATH[w] ?? '/' })}
      onOpenSettings={openSettings}
    />
  );
}

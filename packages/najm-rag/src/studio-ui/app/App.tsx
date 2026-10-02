import React, { useState } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { useRagStudio } from '../lib/context';
import { useStudioAuth } from '../lib/useStudioAuth';
import { useStudioSettings } from '../features/settings/hooks/useStudioSettings';
import { LoginScreen } from '../features/auth';
import { createStudioRouter } from '../routes/router';

export function RagStudioApp() {
  const { basePath, auth } = useRagStudio();
  const { isAuthenticated } = useStudioAuth();
  const { enableKnowledge } = useStudioSettings();
  const [router] = useState(() =>
    createStudioRouter(basePath, { enableKnowledge }),
  );

  // Standalone mode gates the whole app behind a login screen until a Bearer
  // token is present. Session mode (embedded) skips this entirely.
  if (auth === 'standalone' && !isAuthenticated) {
    return <LoginScreen />;
  }

  return <RouterProvider router={router} context={{ enableKnowledge }} />;
}

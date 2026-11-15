import React, { useEffect, useState } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { useRagStudio } from '../lib/context';
import { useStudioAuth } from '../lib/useStudioAuth';
import { useStudioSettings } from '../features/settings/hooks/useStudioSettings';
import { LoginScreen } from '../features/auth';
import { createStudioRouter } from '../routes/router';
import { createHistoryLifetime } from '../routes/history';

export function RagStudioApp() {
  const { basePath, auth } = useRagStudio();
  const { isAuthenticated } = useStudioAuth();
  const { enableKnowledge } = useStudioSettings();
  const [router] = useState(() =>
    createStudioRouter(basePath, { enableKnowledge }),
  );
  const [historyLifetime] = useState(() => createHistoryLifetime(router.history));
  useEffect(() => {
    historyLifetime.retain();
    return () => historyLifetime.release();
  }, [historyLifetime]);

  // Standalone mode gates the whole app behind a login screen until a Bearer
  // token is present. Session mode (embedded) skips this entirely.
  if (auth === 'standalone' && !isAuthenticated) {
    return <LoginScreen />;
  }

  return <RouterProvider router={router} context={{ enableKnowledge }} />;
}

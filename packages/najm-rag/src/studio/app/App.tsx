import React, { useState } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { useRagStudio } from '../lib/context';
import { useStudioSettings } from '../features/settings/hooks/useStudioSettings';
import { createStudioRouter } from '../routes/router';

export function RagStudioApp() {
  const { basePath } = useRagStudio();
  const { enableKnowledge } = useStudioSettings();
  const [router] = useState(() =>
    createStudioRouter(basePath, { enableKnowledge }),
  );

  return <RouterProvider router={router} context={{ enableKnowledge }} />;
}

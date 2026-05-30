import React, { useState } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { useStudio } from '../providers';
import { createStudioRouter } from '../routes/router';

export function WhatsAppStudioApp() {
  const { basePath } = useStudio();
  const [router] = useState(() => {
    if (typeof window !== 'undefined') {
      (window as any).__waStudioBasePath = basePath;
    }
    return createStudioRouter(basePath);
  });

  return <RouterProvider router={router} />;
}

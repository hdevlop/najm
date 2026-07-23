import React, { useState } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { useStudio } from '../providers';
import { createStudioRouter } from '../routes/router';

export function StorageStudioApp() {
  const { basePath } = useStudio();
  const [router] = useState(() => createStudioRouter(basePath));

  return <RouterProvider router={router} />;
}

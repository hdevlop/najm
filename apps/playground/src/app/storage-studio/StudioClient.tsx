'use client';

import { StorageStudioProvider, StorageStudio } from 'najm-storage-studio';
import 'najm-storage-studio/styles.css';

export default function StudioClient() {
  return (
    <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api" basePath="/storage-studio">
      <div className="h-[100dvh] max-h-[100dvh] w-full overflow-hidden">
        <StorageStudio />
      </div>
    </StorageStudioProvider>
  );
}

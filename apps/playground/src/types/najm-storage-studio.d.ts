declare module 'najm-storage-studio' {
  import type { FC, ReactNode } from 'react';
  export const StorageStudioProvider: FC<{ apiBase: string; storageApiBase?: string; getAuthHeaders?: () => Record<string, string>; onUnauthorized?: () => void; children: ReactNode }>;
  export const StorageStudio: FC;
}
declare module 'najm-storage-studio/styles.css' {}

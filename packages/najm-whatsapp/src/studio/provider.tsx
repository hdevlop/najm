import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StudioContext } from './lib/context';
import { createApiClient } from './lib/api';
import type { StudioConfig } from './providers/types';

export function WhatsAppStudioProvider({
  children,
  apiBase,
  getAuthHeaders,
  onUnauthorized,
}: React.PropsWithChildren<StudioConfig>) {
  const getAuthHeadersRef = useRef(getAuthHeaders);
  const onUnauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    getAuthHeadersRef.current = getAuthHeaders;
  }, [getAuthHeaders]);
  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const config = useMemo(
    () => ({
      apiBase,
      getAuthHeaders: () => getAuthHeadersRef.current(),
    }),
    [apiBase],
  );

  const client = useMemo(
    () =>
      createApiClient(config, {
        onUnauthorized: () => onUnauthorizedRef.current?.(),
      }),
    [config],
  );

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem('wa-studio.selectedInstanceId') || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (selectedInstanceId) {
        window.localStorage.setItem('wa-studio.selectedInstanceId', selectedInstanceId);
      } else {
        window.localStorage.removeItem('wa-studio.selectedInstanceId');
      }
    } catch {
      // localStorage unavailable (private mode / SSR) — silently ignore
    }
  }, [selectedInstanceId]);

  return (
    <StudioContext.Provider
      value={{ ...config, client, selectedInstanceId, setSelectedInstanceId }}
    >
      {children}
    </StudioContext.Provider>
  );
}

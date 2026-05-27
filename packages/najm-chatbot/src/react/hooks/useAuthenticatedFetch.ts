'use client';

import { useCallback } from 'react';
import { useAuth } from 'najm-auth/client/react';

export function useAuthenticatedFetch() {
  const { accessToken } = useAuth();

  return useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    return fetch(input, {
      ...init,
      headers,
      credentials: init.credentials ?? 'include',
    });
  }, [accessToken]);
}

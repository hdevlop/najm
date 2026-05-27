import { useEffect, useRef, useState } from 'react';
import { useAuthClient } from './context';
import { useAuth } from './useAuth';
import type { AuthState } from '../types';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface UseSessionOptions {
  /** Require authentication — call onUnauthenticated or redirect if no session */
  required?: boolean;
  /** URL to redirect to if unauthenticated (uses window.location) */
  redirectTo?: string;
  /** Callback when unauthenticated (overrides redirectTo) */
  onUnauthenticated?: () => void;
  /** Callback on error during session init */
  onError?: (error: unknown) => void;
}

interface UseSessionReturn extends AuthState {
  /** True while the initial session check is in progress */
  isLoading: boolean;
  /** Discriminated session status — useful for switch/case rendering */
  status: SessionStatus;
}

/**
 * Initialize session on mount by attempting a refresh.
 * Use this in layout components to hydrate auth state.
 */
export function useSession(opts?: UseSessionOptions): UseSessionReturn {
  const client = useAuthClient();
  const state = useAuth();
  // If the client was hydrated server-side, skip the loading state entirely.
  const [isLoading, setIsLoading] = useState(() => !client.isHydrated());
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    // Hydrated path: refresh in the background to obtain an access token,
    // but never flip isLoading back to true — first paint is authoritative.
    if (client.isHydrated()) {
      if (state.isAuthenticated && !state.accessToken) {
        client.refresh().catch((err) => opts?.onError?.(err));
      }
      return;
    }

    client.refresh()
      .then(() => client.fetchUser())
      .catch((err) => opts?.onError?.(err))
      .finally(() => setIsLoading(false));
  }, [client]);

  // Handle required auth
  useEffect(() => {
    if (isLoading) return;
    if (!opts?.required) return;
    if (state.isAuthenticated) return;

    if (opts.onUnauthenticated) {
      opts.onUnauthenticated();
    } else if (opts.redirectTo && typeof window !== 'undefined') {
      window.location.href = opts.redirectTo;
    }
  }, [isLoading, state.isAuthenticated, opts?.required]);

  const status: SessionStatus = isLoading
    ? 'loading'
    : state.isAuthenticated
      ? 'authenticated'
      : 'unauthenticated';

  return { ...state, isLoading, status };
}

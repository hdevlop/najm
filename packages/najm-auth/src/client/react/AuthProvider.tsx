import { useEffect, useRef, type ReactNode } from 'react';
import { AuthClientContext, useAuthClient } from './context';
import { useAuth } from './useAuth';
import type { NajmAuthClient, HydrateSession } from '../NajmAuthClient';

interface AuthProviderProps {
  client: NajmAuthClient;
  children: ReactNode;
  /**
   * Session resolved server-side. When provided, the client is hydrated
   * synchronously before first paint, eliminating the loading flicker.
   * Pass `null` to assert "no session" (also skips the boot fetch).
   */
  initialSession?: HydrateSession | null;
  /**
   * Auto-refresh the access token in the background when the hydrated
   * session has a user but no access token. Default: true.
   * Children always render; the refresh does not gate the tree.
   */
  autoRefresh?: boolean;
}

export function AuthProvider({
  client,
  children,
  initialSession,
  autoRefresh = true,
}: AuthProviderProps) {
  const hydrated = useRef(false);
  if (!hydrated.current && initialSession !== undefined) {
    client.hydrate(initialSession);
    hydrated.current = true;
  }

  return (
    <AuthClientContext.Provider value={client}>
      {autoRefresh ? <AutoRefresh /> : null}
      {children}
    </AuthClientContext.Provider>
  );
}

function AutoRefresh() {
  const { isAuthenticated, accessToken } = useAuth();
  const client = useAuthClient();
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    if (isAuthenticated && !accessToken) {
      triggered.current = true;
      client.refresh().catch(() => {});
    }
  }, [isAuthenticated, accessToken, client]);

  return null;
}

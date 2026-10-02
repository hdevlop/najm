import { useCallback, useSyncExternalStore } from 'react';
import { useRagStudio } from './context';
import { subscribe, getToken, setToken, clearToken } from './authStore';

export interface StudioAuthState {
  token: string | null;
  isAuthenticated: boolean;
  /** Log in against the target app's najm-auth and store the Bearer token. */
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
}

/** Tolerant extraction of the access token from najm-auth's login response. */
function extractToken(json: any): string | null {
  return (
    json?.accessToken ??
    json?.token ??
    json?.data?.accessToken ??
    json?.data?.token ??
    null
  );
}

export function useStudioAuth(): StudioAuthState {
  const { authApiBase } = useRagStudio();

  const token = useSyncExternalStore(
    subscribe,
    () => getToken(),
    () => null,
  );

  const login = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const res = await fetch(`${authApiBase}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!res.ok) {
        let message = res.statusText || `HTTP ${res.status}`;
        try {
          const body = await res.json();
          message = body?.message ?? body?.error ?? message;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }

      const json = await res.json().catch(() => null);
      const accessToken = extractToken(json);
      if (!accessToken) {
        throw new Error('Login succeeded but no access token was returned.');
      }
      setToken(accessToken);
    },
    [authApiBase],
  );

  const logout = useCallback(() => clearToken(), []);

  return { token, isAuthenticated: !!token, login, logout };
}

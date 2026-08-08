import { useCallback, useState } from 'react';
import { useAuthClient } from './context';
import type { AuthUser, LoginCredentials, LoginResult } from '../types';
import { AuthError } from '../types';

interface UseLoginOptions {
  /** Fires for both branches — check `result.nextStep` before routing. */
  onSuccess?: (result: LoginResult) => void;
  /** Fires only for a completed session. */
  onAuthenticated?: (user: AuthUser) => void;
  /** Fires when the account must replace its credential first. */
  onCredentialSetup?: (setup: Extract<LoginResult, { nextStep: 'credential_setup' }>) => void;
  onError?: (error: AuthError | Error) => void;
}

interface UseLoginReturn {
  login: (credentials: LoginCredentials) => Promise<LoginResult | undefined>;
  isLoading: boolean;
  error: AuthError | Error | null;
}

export function useLogin(opts?: UseLoginOptions): UseLoginReturn {
  const client = useAuthClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | Error | null>(null);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.login(credentials);
      opts?.onSuccess?.(result);
      if (result.nextStep === 'credential_setup') {
        opts?.onCredentialSetup?.(result);
      } else {
        opts?.onAuthenticated?.(result.user);
      }
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      opts?.onError?.(e as AuthError | Error);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [client, opts?.onSuccess, opts?.onAuthenticated, opts?.onCredentialSetup, opts?.onError]);

  return { login, isLoading, error };
}

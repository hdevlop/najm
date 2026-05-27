import { useCallback, useState } from 'react';
import { useAuthClient } from './context';
import type { AuthUser } from '../types';
import { AuthError } from '../types';

interface UseLoginOptions {
  onSuccess?: (user: AuthUser) => void;
  onError?: (error: AuthError | Error) => void;
}

interface UseLoginReturn {
  login: (credentials: { email: string; password: string }) => Promise<void>;
  isLoading: boolean;
  error: AuthError | Error | null;
}

export function useLogin(opts?: UseLoginOptions): UseLoginReturn {
  const client = useAuthClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | Error | null>(null);

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await client.login(credentials);
      opts?.onSuccess?.(user);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      opts?.onError?.(e as AuthError | Error);
    } finally {
      setIsLoading(false);
    }
  }, [client, opts?.onSuccess, opts?.onError]);

  return { login, isLoading, error };
}

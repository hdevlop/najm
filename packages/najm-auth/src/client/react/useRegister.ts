import { useCallback, useState } from 'react';
import { useAuthClient } from './context';
import type { AuthUser } from '../types';
import { AuthError } from '../types';

interface UseRegisterOptions {
  onSuccess?: (user: AuthUser) => void;
  onError?: (error: AuthError | Error) => void;
}

interface UseRegisterReturn {
  register: (data: Record<string, unknown>) => Promise<void>;
  isLoading: boolean;
  error: AuthError | Error | null;
}

export function useRegister(opts?: UseRegisterOptions): UseRegisterReturn {
  const client = useAuthClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | Error | null>(null);

  const register = useCallback(async (data: Record<string, unknown>) => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await client.register(data);
      opts?.onSuccess?.(user);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      opts?.onError?.(e as AuthError | Error);
    } finally {
      setIsLoading(false);
    }
  }, [client, opts?.onSuccess, opts?.onError]);

  return { register, isLoading, error };
}

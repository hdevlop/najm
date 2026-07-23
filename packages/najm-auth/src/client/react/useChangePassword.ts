import { useCallback, useState } from 'react';
import { useAuthClient } from './context';
import { AuthError } from '../types';

interface UseChangePasswordOptions {
  onSuccess?: () => void;
  onError?: (error: AuthError | Error) => void;
}

interface UseChangePasswordReturn {
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  isLoading: boolean;
  error: AuthError | Error | null;
  isSuccess: boolean;
  reset: () => void;
}

export function useChangePassword(opts?: UseChangePasswordOptions): UseChangePasswordReturn {
  const client = useAuthClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const changePassword = useCallback(async (data: { currentPassword: string; newPassword: string }) => {
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      await client.changePassword(data);
      setIsSuccess(true);
      opts?.onSuccess?.();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      opts?.onError?.(e as AuthError | Error);
    } finally {
      setIsLoading(false);
    }
  }, [client, opts?.onSuccess, opts?.onError]);

  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  return { changePassword, isLoading, error, isSuccess, reset };
}

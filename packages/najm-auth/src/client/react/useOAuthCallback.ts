import { useCallback, useRef, useState } from 'react';
import type { AuthUser } from '../types';
import { AuthError } from '../types';
import { useAuthClient } from './context';

interface UseOAuthCallbackOptions {
  onSuccess?: (user: AuthUser) => void;
  onError?: (error: AuthError | Error) => void;
}

export function useOAuthCallback(options?: UseOAuthCallbackOptions) {
  const client = useAuthClient();
  const promise = useRef<Promise<AuthUser> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | Error | null>(null);

  const complete = useCallback(async (): Promise<AuthUser> => {
    if (promise.current) return promise.current;
    setIsLoading(true);
    setError(null);
    promise.current = client.completeOAuthLogin();
    try {
      const user = await promise.current;
      options?.onSuccess?.(user);
      return user;
    } catch (value) {
      const next = value instanceof Error ? value : new Error(String(value));
      setError(next);
      options?.onError?.(next as AuthError | Error);
      throw next;
    } finally {
      setIsLoading(false);
    }
  }, [client, options?.onSuccess, options?.onError]);

  return { complete, isLoading, error };
}

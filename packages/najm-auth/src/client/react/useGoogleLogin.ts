import { useCallback, useState } from 'react';
import type { OAuthLoginOptions } from '../types';
import { AuthError } from '../types';
import { useAuthClient } from './context';

interface UseGoogleLoginOptions {
  onError?: (error: AuthError | Error) => void;
}

interface UseGoogleLoginReturn {
  loginWithGoogle: (options?: OAuthLoginOptions) => void;
  linkGoogle: (options?: OAuthLoginOptions) => Promise<void>;
  isRedirecting: boolean;
  error: AuthError | Error | null;
}

export function useGoogleLogin(options?: UseGoogleLoginOptions): UseGoogleLoginReturn {
  const client = useAuthClient();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<AuthError | Error | null>(null);

  const fail = useCallback((value: unknown) => {
    const next = value instanceof Error ? value : new Error(String(value));
    setIsRedirecting(false);
    setError(next);
    options?.onError?.(next as AuthError | Error);
  }, [options?.onError]);

  const loginWithGoogle = useCallback((loginOptions?: OAuthLoginOptions) => {
    setError(null);
    setIsRedirecting(true);
    try {
      client.loginWithGoogle(loginOptions);
    } catch (value) {
      fail(value);
    }
  }, [client, fail]);

  const linkGoogle = useCallback(async (loginOptions?: OAuthLoginOptions) => {
    setError(null);
    setIsRedirecting(true);
    try {
      await client.linkOAuthAccount('google', loginOptions);
    } catch (value) {
      fail(value);
    }
  }, [client, fail]);

  return { loginWithGoogle, linkGoogle, isRedirecting, error };
}

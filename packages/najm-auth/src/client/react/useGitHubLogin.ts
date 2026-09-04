import { useCallback, useState } from 'react';
import type { OAuthLoginOptions } from '../types';
import { AuthError } from '../types';
import { useAuthClient } from './context';

interface UseGitHubLoginOptions {
  onError?: (error: AuthError | Error) => void;
}

interface UseGitHubLoginReturn {
  loginWithGitHub: (options?: OAuthLoginOptions) => void;
  linkGitHub: (options?: OAuthLoginOptions) => Promise<void>;
  isRedirecting: boolean;
  error: AuthError | Error | null;
}

export function useGitHubLogin(options?: UseGitHubLoginOptions): UseGitHubLoginReturn {
  const client = useAuthClient();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<AuthError | Error | null>(null);

  const fail = useCallback((value: unknown) => {
    const next = value instanceof Error ? value : new Error(String(value));
    setIsRedirecting(false);
    setError(next);
    options?.onError?.(next as AuthError | Error);
  }, [options?.onError]);

  const loginWithGitHub = useCallback((loginOptions?: OAuthLoginOptions) => {
    setError(null);
    setIsRedirecting(true);
    try {
      client.loginWithGitHub(loginOptions);
    } catch (value) {
      fail(value);
    }
  }, [client, fail]);

  const linkGitHub = useCallback(async (loginOptions?: OAuthLoginOptions) => {
    setError(null);
    setIsRedirecting(true);
    try {
      await client.linkOAuthAccount('github', loginOptions);
    } catch (value) {
      fail(value);
    }
  }, [client, fail]);

  return { loginWithGitHub, linkGitHub, isRedirecting, error };
}

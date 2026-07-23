import { useCallback, useState } from 'react';
import { useAuthClient } from './context';

interface UseLogoutOptions {
  /** URL to redirect to after logout (uses window.location for full page reload) */
  redirectTo?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseLogoutReturn {
  logout: () => Promise<void>;
  isLoading: boolean;
}

export function useLogout(opts?: UseLogoutOptions): UseLogoutReturn {
  const client = useAuthClient();
  const [isLoading, setIsLoading] = useState(false);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await client.logout();

      // Redirect immediately — no waiting for React re-render cycle
      if (opts?.redirectTo && typeof window !== 'undefined') {
        window.location.href = opts.redirectTo;
        return; // page is unloading, don't reset isLoading
      }

      opts?.onSuccess?.();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      opts?.onError?.(e);
    } finally {
      setIsLoading(false);
    }
  }, [client, opts?.onSuccess, opts?.onError, opts?.redirectTo]);

  return { logout, isLoading };
}

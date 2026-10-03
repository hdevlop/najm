import { useEffect, type ReactNode } from 'react';
import { useOAuthCallback } from './useOAuthCallback';
import { normalizeLocalRedirectPath } from '../redirectPath';

interface OAuthCallbackProps {
  fallback?: ReactNode;
  errorFallback?: ReactNode | ((props: { error: Error }) => ReactNode);
  defaultRedirect?: string;
}

const safeReturnTo = (value: string | null, fallback: string): string => {
  return normalizeLocalRedirectPath(value) ?? normalizeLocalRedirectPath(fallback) ?? '/';
};

export function OAuthCallback({
  fallback = null,
  errorFallback = null,
  defaultRedirect = '/',
}: OAuthCallbackProps) {
  const { complete, error } = useOAuthCallback();

  useEffect(() => {
    complete().then(() => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      window.location.replace(safeReturnTo(params.get('returnTo'), defaultRedirect));
    }).catch(() => { });
  }, [complete, defaultRedirect]);

  if (error) {
    return <>{typeof errorFallback === 'function' ? errorFallback({ error }) : errorFallback}</>;
  }
  return <>{fallback}</>;
}

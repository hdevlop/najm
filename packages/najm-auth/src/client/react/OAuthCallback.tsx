import { useEffect, type ReactNode } from 'react';
import { useOAuthCallback } from './useOAuthCallback';

interface OAuthCallbackProps {
  fallback?: ReactNode;
  errorFallback?: ReactNode | ((props: { error: Error }) => ReactNode);
  defaultRedirect?: string;
}

const safeReturnTo = (value: string | null, fallback: string): string => {
  const safeFallback = fallback.startsWith('/') && !fallback.startsWith('//') && !fallback.includes('\\')
    ? fallback
    : '/';
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return safeFallback;
  try {
    const base = new URL('https://najm.invalid');
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) return safeFallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return safeFallback;
  }
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

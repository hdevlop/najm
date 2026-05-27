import { useEffect } from 'react';

interface RedirectToLoginProps {
  /** Login URL (default: '/login') */
  to?: string;
  /** Preserve current URL as ?from= param (default: true) */
  preserveFrom?: boolean;
}

/**
 * Immediately redirects to the login page. Renders nothing.
 * Use inside <SignedOut> or <Protected fallback={...}>.
 *
 * @example
 * ```tsx
 * <SignedOut>
 *   <RedirectToLogin to="/login" />
 * </SignedOut>
 * ```
 */
export function RedirectToLogin({ to = '/login', preserveFrom = true }: RedirectToLoginProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = preserveFrom
      ? `${to}?from=${encodeURIComponent(window.location.pathname + window.location.search)}`
      : to;
    window.location.href = target;
  }, [to, preserveFrom]);

  return null;
}

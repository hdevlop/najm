// ============================================================================
// AuthGate — Full-page auth gate component
// ============================================================================
//
// Unlike hooks, AuthGate BLOCKS the entire subtree from rendering until
// auth state is resolved. This prevents any flash of protected content.
//
// @example
// ```tsx
// // app/dashboard/layout.tsx
// <AuthGate loader={<FullPageSpinner />} redirectTo="/login">
//   <DashboardShell>{children}</DashboardShell>
// </AuthGate>
// ```
// ============================================================================

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useAuthClient } from './context';

interface AuthGateProps {
  children: ReactNode;
  /** Full-page loader shown while resolving auth on hard reload */
  loader?: ReactNode;
  /** Where to redirect when unauthenticated (uses window.location for full reload) */
  redirectTo?: string;
  /** Callback when unauthenticated (overrides redirectTo) */
  onUnauthenticated?: () => void;
  /** Required role — renders `denied` if user lacks it */
  role?: string;
  /** Required permission — renders `denied` if user lacks it */
  permission?: string;
  /** Shown when role/permission check fails (defaults to null) */
  denied?: ReactNode;
}

/**
 * Full-page authentication gate.
 *
 * **Key difference from hooks**: AuthGate never renders `children` until
 * auth is confirmed. No conditional rendering bugs, no layout shift,
 * no flash of protected content.
 *
 * **With SSR hydration**: If `AuthProvider` was hydrated with `initialSession`,
 * the gate opens immediately on first render — no loader flash.
 *
 * **Without SSR hydration** (client-side nav, hard reload without initialSession):
 * Shows `loader` while attempting a token refresh, then either opens or redirects.
 */
export function AuthGate({
  children,
  loader = null,
  redirectTo,
  onUnauthenticated,
  role,
  permission,
  denied = null,
}: AuthGateProps) {
  const client = useAuthClient();
  const state = useSyncExternalStore(
    (cb) => client.subscribe(cb),
    () => client.getState(),
    () => client.getState(),
  );

  const hydrated = client.isHydrated();

  // If not hydrated (no SSR initialSession), attempt token refresh
  useEffect(() => {
    if (hydrated) return;
    client.refresh()
      .then(() => client.fetchUser())
      .catch(() => {});
  }, [client, hydrated]);

  // ---- LOADING: show loader until auth is resolved ----
  if (!hydrated && !state.isAuthenticated) {
    return <>{loader}</>;
  }

  // ---- UNAUTHENTICATED: redirect or callback ----
  if (!state.isAuthenticated) {
    if (onUnauthenticated) {
      onUnauthenticated();
    } else if (redirectTo && typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
    // Keep showing loader during redirect to prevent flash
    return <>{loader}</>;
  }

  // ---- ROLE CHECK ----
  if (role && !client.hasRole(role)) {
    return <>{denied}</>;
  }

  // ---- PERMISSION CHECK ----
  if (permission && !client.can(permission)) {
    return <>{denied}</>;
  }

  // ---- AUTHORIZED: render children ----
  return <>{children}</>;
}

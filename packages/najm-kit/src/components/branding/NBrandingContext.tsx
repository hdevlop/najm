import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface NBrandingValue {
  /** Used as the logo's `alt` when the logo does not set one. */
  appName?: string;
  logoExpanded?: ReactNode | string;
  /** Falls back to `logoExpanded`. */
  logoCollapsed?: ReactNode | string;
  /** Swapped in when a `string` logo fails to load. */
  logoFallback?: string;
  logoHref?: string;
}

const NBrandingContext = createContext<NBrandingValue | null>(null);

/** Returns `null` outside a provider, so every consumer stays optional. */
export function useNBranding(): NBrandingValue | null {
  return useContext(NBrandingContext);
}

/**
 * Publishes the app's marks once, so shells stop threading a `logo` through
 * every surface that shows one. `NSidebar` reads this when no `logo` prop is
 * given; an explicit `logo` always wins.
 *
 * Unlike `NSidebarProvider` this owns no state — the values are resolved by the
 * app (usually server-side) and only forwarded, so memoizing on the fields is
 * correct here.
 */
export function NBrandingProvider({
  children,
  appName,
  logoExpanded,
  logoCollapsed,
  logoFallback,
  logoHref,
}: Readonly<NBrandingValue & { children: ReactNode }>) {
  const value = useMemo<NBrandingValue>(
    () => ({ appName, logoExpanded, logoCollapsed, logoFallback, logoHref }),
    [appName, logoExpanded, logoCollapsed, logoFallback, logoHref],
  );

  return <NBrandingContext.Provider value={value}>{children}</NBrandingContext.Provider>;
}

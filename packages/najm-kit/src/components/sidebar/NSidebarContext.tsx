import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface NSidebarContextValue {
  collapsed: boolean;
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  setMobileOpen: (open: boolean) => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  mobileBreakpoint: "sm" | "md" | "lg";
}

const NSidebarContext = createContext<NSidebarContextValue | null>(null);

/**
 * Returns `null` outside a provider, which is what lets `NSidebar` keep its own
 * state when it is used standalone. Consumers that need the sidebar from a
 * distance — `NPageHeader`'s mobile trigger, most of all — read it from here.
 */
export function useNSidebar(): NSidebarContextValue | null {
  return useContext(NSidebarContext);
}

/**
 * Owns the sidebar's open/collapsed state so that content rendered *beside* the
 * sidebar can reach it. `NSidebar` is a sibling of the page content, so this has
 * to wrap both — it cannot live inside `NSidebar` itself.
 *
 * The provider owns the state rather than forwarding a caller-built value: a
 * pass-through provider has to memoize on the value's fields, which silently
 * drops changed callback identities and serves stale closures.
 */
export function NSidebarProvider({
  children,
  defaultCollapsed = false,
  mobileBreakpoint = "md",
}: Readonly<{
  children: ReactNode;
  defaultCollapsed?: boolean;
  mobileBreakpoint?: "sm" | "md" | "lg";
}>) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), []);

  const value = useMemo<NSidebarContextValue>(
    () => ({
      collapsed,
      mobileOpen,
      openMobile,
      closeMobile,
      setMobileOpen,
      setCollapsed,
      toggleCollapsed,
      mobileBreakpoint,
    }),
    [collapsed, mobileOpen, openMobile, closeMobile, toggleCollapsed, mobileBreakpoint],
  );

  return <NSidebarContext.Provider value={value}>{children}</NSidebarContext.Provider>;
}

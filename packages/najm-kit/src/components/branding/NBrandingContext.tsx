import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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

/**
 * What a Najm branding endpoint returns, as the marks the chrome needs.
 *
 * Accepted anywhere branding goes *in* so an application hands over its API
 * payload unchanged instead of renaming two fields at every call site. Fields
 * beyond these are ignored: excess-property checks only fire on object
 * literals, so passing a wider response object — auth logos, a revision — type
 * checks and drops what the chrome has no use for.
 */
export interface NBrandingPayload {
  sidebarLogoExpandedPath?: string | null;
  sidebarLogoCollapsedPath?: string | null;
  /**
   * A slot registry, as `najm-theme` resolves branding: slot key to path.
   *
   * Read here so a themed application passes what `loadServerBranding()`
   * returned straight through, rather than renaming two of its slots at the
   * one call site that mounts the chrome. Only the two sidebar keys are read,
   * so an auth logo, a hero, and a consumer's own slots stay out of the
   * context the sidebar sees.
   *
   * Structural on purpose: the kit does not depend on `najm-theme`, and the
   * dependency runs the other way.
   */
  slots?: Record<string, string | null>;
}

/** Resolved marks, an endpoint payload, or both. */
export type NBrandingInput = NBrandingValue & NBrandingPayload;

/**
 * Projects an input onto the marks `useNBranding` publishes.
 *
 * Explicit marks win over payload fields, which win over slots, so an
 * application already passing `logoExpanded` — or a `ReactNode` logo, which no
 * payload can express — is unaffected by the wider input type.
 */
export function normalizeBranding(input?: NBrandingInput): NBrandingValue {
  if (!input) return {};

  // Picked field by field rather than rest-spread: a payload is a whole API
  // response, and spreading it would publish an auth logo path and a revision
  // through the context the sidebar reads.
  const value: NBrandingValue = {};
  const expanded =
    input.logoExpanded ?? input.sidebarLogoExpandedPath ?? input.slots?.sidebarLogoExpanded;
  const collapsed =
    input.logoCollapsed ?? input.sidebarLogoCollapsedPath ?? input.slots?.sidebarLogoCollapsed;

  // Assigned only when present. `setBranding` merges its result over the
  // current marks, so writing `logoExpanded: undefined` for a patch that never
  // mentioned a logo would clear one already set.
  if (input.appName !== undefined) value.appName = input.appName;
  if (input.logoFallback !== undefined) value.logoFallback = input.logoFallback;
  if (input.logoHref !== undefined) value.logoHref = input.logoHref;
  if (expanded !== undefined) value.logoExpanded = expanded;
  if (collapsed !== undefined) value.logoCollapsed = collapsed;

  return value;
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

export interface NBrandingEditorValue {
  branding: NBrandingValue;
  /**
   * Merges a patch over the current marks. Inert while controlled.
   *
   * Takes the endpoint payload shape too, so a settings surface hands back the
   * response it just received rather than renaming its fields first.
   */
  setBranding: (patch: NBrandingInput) => void;
}

const NBrandingEditorContext = createContext<NBrandingEditorValue | null>(null);

/**
 * Lets a settings surface swap the app's marks without a reload.
 *
 * Returns `null` outside `NBrandingStateProvider`, so a branding editor stays
 * mountable in an app that resolves its logos once and never changes them.
 *
 * Only the *display* values live here. Where the assets are stored, who may
 * replace them, and what happens to a superseded upload are the application's
 * concerns, and folding them in would make this a branding backend.
 */
export function useNBrandingEditor(): NBrandingEditorValue | null {
  return useContext(NBrandingEditorContext);
}

export interface NBrandingStateProviderProps {
  children: ReactNode;
  /** Controlled marks. When given, `setBranding` is inert. */
  branding?: NBrandingInput;
  /** Seeds marks this provider owns from then on; ignored after mount. */
  initialBranding?: NBrandingInput;
}

/** `NBrandingProvider` with the marks held as state an editor can write. */
export function NBrandingStateProvider({
  children,
  branding,
  initialBranding,
}: Readonly<NBrandingStateProviderProps>) {
  const [state, setState] = useState<NBrandingValue>(() =>
    normalizeBranding(initialBranding ?? branding),
  );

  const setBranding = useCallback((patch: NBrandingInput) => {
    const marks = normalizeBranding(patch);
    setState((current) => ({ ...current, ...marks }));
  }, []);

  // Memoized on the prop's identity: projecting on every render would hand the
  // memo below a fresh object each time and defeat it.
  const controlled = useMemo(
    () => (branding ? normalizeBranding(branding) : undefined),
    [branding],
  );

  const resolved = controlled ?? state;

  const editor = useMemo<NBrandingEditorValue>(
    () => ({ branding: resolved, setBranding: branding ? noop : setBranding }),
    [resolved, branding, setBranding],
  );

  return (
    <NBrandingEditorContext.Provider value={editor}>
      <NBrandingProvider {...resolved}>{children}</NBrandingProvider>
    </NBrandingEditorContext.Provider>
  );
}

function noop() {}

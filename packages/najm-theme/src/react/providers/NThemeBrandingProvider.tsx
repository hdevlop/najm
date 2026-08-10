// ============================================================================
// najm-theme/react — resolved branding for the product chrome
// ============================================================================
//
// The one thing a themed application renders everywhere and used to re-derive
// everywhere: which image belongs in which slot right now.
//
// This is not the settings provider. `NThemeSettingsProvider` owns the *admin*
// view — draft state, dirty tracking, uploads, revisions — and is mounted on a
// settings page. This one owns the read-only answer the sidebar and the sign-in
// page need, is mounted at the root, and holds four strings.
//
// The factory fallback is on the value, not a separate prop: the definition-
// backed RSC bootstrap attaches it to the branding it returns, so a standard
// consumer passes only what `loadServerBranding()` produced. A consumer with
// no factory directory can still pass a branding with `factory` set by hand
// — the chain is the same.
// ============================================================================

"use client";

import * as React from "react";

import type { PublicBranding } from "../../contracts/branding";
import type { StandardBrandingSlotKey } from "../../contracts/factory";

export interface NThemeBrandingValue {
  /** Slot key to the path to render, or `null` when the slot resolves to nothing. */
  slots: Record<string, string | null>;
  /** Slot key to the factory file, used when a managed asset fails to load. */
  factory: Record<string, string | null>;
  revision: number;
}

const NThemeBrandingContext = React.createContext<NThemeBrandingValue | null>(null);

export interface NThemeBrandingProviderProps {
  children: React.ReactNode;
  /**
   * What the server render resolved — the value `loadServerBranding()` returned.
   *
   * Passing the payload unchanged is the point: the resolution order (managed
   * asset, then factory file) already ran on the server, against the storage the
   * browser cannot see, and re-deciding it here is what produced the fallback
   * maps this provider exists to delete.
   *
   * A `factory` map on the payload, when present, is what the slot renderer
   * falls back to after a managed asset 404s. The definition-backed bootstrap
   * attaches it; consumers that resolve branding by other means can attach one
   * of their own.
   */
  branding: PublicBranding;
}

/**
 * Publishes the resolved branding once, near the root.
 *
 * Deliberately holds no state and fetches nothing. A branding change is a new
 * server render — the settings page updates its own preview optimistically and
 * then refreshes — so a provider that re-fetched would be a second source of
 * truth that disagrees with the HTML for one paint.
 */
export function NThemeBrandingProvider({
  children,
  branding,
}: Readonly<NThemeBrandingProviderProps>) {
  const value = React.useMemo<NThemeBrandingValue>(
    () => ({
      slots: branding?.slots ?? {},
      factory: branding?.factory ?? {},
      revision: branding?.revision ?? 1,
    }),
    [branding],
  );

  return (
    <NThemeBrandingContext.Provider value={value}>{children}</NThemeBrandingContext.Provider>
  );
}

/**
 * The resolved branding, or `null` outside the provider.
 *
 * The optional form exists for a component that legitimately renders in both
 * trees. `NThemeImage` uses the strict `useNThemeBranding` below instead: a slot
 * renderer that silently rendered nothing outside its provider would make a
 * missing root provider look like a missing logo, which is the same symptom as
 * a broken upload and takes an afternoon to tell apart.
 */
export function useNThemeBrandingOptional(): NThemeBrandingValue | null {
  return React.useContext(NThemeBrandingContext);
}

export function useNThemeBranding(): NThemeBrandingValue {
  const value = React.useContext(NThemeBrandingContext);
  if (!value) {
    throw new Error(
      "[najm-theme] useNThemeBranding requires <NThemeBrandingProvider branding={…}> above it. "
        + "Mount it in the root layout with the value loadServerBranding() returned.",
    );
  }
  return value;
}

/** The path currently resolved for a slot, or `null`. */
export function useNThemeBrandingSlot(slot: StandardBrandingSlotKey | (string & {})): string | null {
  return useNThemeBranding().slots[slot] ?? null;
}

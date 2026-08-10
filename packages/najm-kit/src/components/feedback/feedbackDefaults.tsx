import * as React from "react";

import type { NajmTranslate } from "../../providers/paginationLabels";

/**
 * Default text used when no provider is mounted and no prop is supplied.
 *
 * Only the fields that genuinely have a packaged fallback live here. Generic
 * error body copy and empty-state description deliberately have none — the
 * no-provider render must look the same as it did before this contract
 * shipped.
 */
export const ENGLISH_FEEDBACK_LABELS = {
  loadingLabel: "Loading...",
  emptyTitle: "No data",
  errorTitle: "Something went wrong",
  retryLabel: "Try again",
  forbiddenTitle: "Access denied",
  forbiddenDescription: "You do not have permission to view this page.",
  notFoundTitle: "Page not found",
  notFoundDescription: "The requested page could not be found.",
} as const;

export type NFeedbackLabelKey =
  | keyof typeof ENGLISH_FEEDBACK_LABELS
  | "errorMessage";

/**
 * Optional literal labels, supplied as `feedbackDefaults.labels`. Each field
 * is independent: an application can localize one feedback label without
 * touching the others.
 *
 * `errorMessage` is the only key without a packaged fallback. A consumer that
 * supplies one opts a generic error state into rendering a body; absent that
 * opt-in, the no-provider behavior is unchanged.
 */
export interface NFeedbackLabels {
  loadingLabel?: string;
  emptyTitle?: string;
  errorTitle?: string;
  errorMessage?: string;
  retryLabel?: string;
  forbiddenTitle?: string;
  forbiddenDescription?: string;
  notFoundTitle?: string;
  notFoundDescription?: string;
}

/**
 * Map from a feedback field to a translation catalog key. Resolved through the
 * provider's structural `t`. Optional per-field; a missing key falls through
 * to the literal default, then to packaged English.
 */
export interface NFeedbackLabelKeys {
  loadingLabel?: string;
  emptyTitle?: string;
  errorTitle?: string;
  errorMessage?: string;
  retryLabel?: string;
  forbiddenTitle?: string;
  forbiddenDescription?: string;
  notFoundTitle?: string;
  notFoundDescription?: string;
}

/**
 * Provider-level defaults for the shared feedback components.
 *
 * Threaded through `NajmUIProvider.feedbackDefaults` and inherited by the
 * `next` and `app` adapters. No second adapter prop or translation source:
 * the same structural `t` every table and badge reads is what these labels
 * route through.
 */
export interface NFeedbackDefaults {
  /**
   * Literal overrides. A field that is `undefined` here still resolves through
   * `labelKeys` and the packaged English fallback.
   */
  labels?: NFeedbackLabels;
  /**
   * Catalog keys resolved through the provider's `t`. Memoize the object: a
   * fresh identity on every render rebuilds the label bundle and re-renders
   * every feedback state beneath the provider.
   */
  labelKeys?: NFeedbackLabelKeys;
  /**
   * Catalog prefix for translated keys. Keys are read as `<prefix>.<field>`.
   * Defaults to `"common.feedback"`.
   */
  prefix?: string;
}

export interface NFeedbackDefaultsContextValue {
  defaults: NFeedbackDefaults;
  t: NajmTranslate | undefined;
}

const NFeedbackDefaultsContext =
  React.createContext<NFeedbackDefaultsContextValue | null>(null);

export interface NFeedbackDefaultsProviderProps {
  value: NFeedbackDefaultsContextValue;
  children: React.ReactNode;
}

/**
 * Mounted by `NajmUIProvider`. The tree of every feedback state component
 * reads its final resolved text from this context, so the same provider
 * configuration reaches every call site without per-call repetition.
 */
export function NFeedbackDefaultsProvider({
  value,
  children,
}: NFeedbackDefaultsProviderProps) {
  return (
    <NFeedbackDefaultsContext.Provider value={value}>
      {children}
    </NFeedbackDefaultsContext.Provider>
  );
}

/** The active feedback-defaults context, or `null` outside a provider. */
export function useNFeedbackDefaults(): NFeedbackDefaultsContextValue | null {
  return React.useContext(NFeedbackDefaultsContext);
}

export const DEFAULT_FEEDBACK_KEY_PREFIX = "common.feedback";

/**
 * The fully resolved label bundle, ready for a feedback component to consume.
 *
 * Resolution order, most specific first:
 *   1. `labels[name]` (literal default).
 *   2. `labelKeys[name]` resolved through `t`.
 *   3. Packaged English for fields that have one. Missing fields stay
 *      `undefined` — generic `errorMessage` and `emptyDescription` have no
 *      packaged fallback by design.
 *
 * Memoized on `[value.defaults, value.t]` so a language change reaches every
 * consumer without remounting and without rebuilding on unrelated identity
 * flips.
 */
export function useResolvedFeedbackLabels(): ResolvedFeedbackLabels {
  const ctx = useNFeedbackDefaults();
  return React.useMemo(() => resolveFeedbackLabels(ctx), [ctx]);
}

export interface ResolvedFeedbackLabels {
  loadingLabel: string;
  emptyTitle: string;
  errorTitle: string;
  errorMessage: string | undefined;
  retryLabel: string;
  forbiddenTitle: string;
  forbiddenDescription: string;
  notFoundTitle: string;
  notFoundDescription: string;
}

export function resolveFeedbackLabels(
  ctx: NFeedbackDefaultsContextValue | null,
): ResolvedFeedbackLabels {
  const defaults = ctx?.defaults;
  const t = ctx?.t;
  const labels = defaults?.labels;
  const labelKeys = defaults?.labelKeys;
  const prefix = defaults?.prefix ?? DEFAULT_FEEDBACK_KEY_PREFIX;

  const pick = (
    field: NFeedbackLabelKey,
    hasFallback: boolean,
  ): string | undefined => {
    const literal = (labels as Record<string, string | undefined> | undefined)?.[field];
    if (literal !== undefined) return literal;
    const key = (labelKeys as Record<string, string | undefined> | undefined)?.[field];
    if (key && t) return t(key);
    if (hasFallback) return ENGLISH_FEEDBACK_LABELS[field];
    return undefined;
  };

  return {
    loadingLabel: pick("loadingLabel", true) ?? ENGLISH_FEEDBACK_LABELS.loadingLabel,
    emptyTitle: pick("emptyTitle", true) ?? ENGLISH_FEEDBACK_LABELS.emptyTitle,
    errorTitle: pick("errorTitle", true) ?? ENGLISH_FEEDBACK_LABELS.errorTitle,
    errorMessage: pick("errorMessage", false),
    retryLabel: pick("retryLabel", true) ?? ENGLISH_FEEDBACK_LABELS.retryLabel,
    forbiddenTitle:
      pick("forbiddenTitle", true) ?? ENGLISH_FEEDBACK_LABELS.forbiddenTitle,
    forbiddenDescription:
      pick("forbiddenDescription", true) ??
      ENGLISH_FEEDBACK_LABELS.forbiddenDescription,
    notFoundTitle:
      pick("notFoundTitle", true) ?? ENGLISH_FEEDBACK_LABELS.notFoundTitle,
    notFoundDescription:
      pick("notFoundDescription", true) ??
      ENGLISH_FEEDBACK_LABELS.notFoundDescription,
  };
}

/**
 * One combined context value, memoized for provider mounting.
 *
 * The provider's hook (`useNFeedbackDefaults`) is what components read; this
 * helper exists so the mount site can build the value once, with stable
 * identity, and pass it down.
 *
 * Not a hook: starts with `resolve` rather than `use` so it is safe to call
 * from inside another hook's memo callback.
 */
export function resolveFeedbackDefaultsValue(
  defaults: NFeedbackDefaults | undefined,
  t: NajmTranslate | undefined,
): NFeedbackDefaultsContextValue {
  return { defaults: defaults ?? {}, t };
}

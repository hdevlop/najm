import * as React from "react";
import { DirectionProvider } from "@radix-ui/react-direction";

import { cn } from "../lib/cn";
import { NajmDesignProvider } from "../theme/design-provider";
import type { NajmDesignConfig } from "../theme/design-types";
// Imported from the module rather than the `components/table` barrel: this file
// is reachable from the `najm-kit/next` entry, and the barrel pulls NTable and
// its dependencies into that bundle for the sake of one context provider.
import { NTableDefaultsProvider } from "../components/table/TableDefaults";
import type { NTableDefaults } from "../components/table/TableDefaults";
// Same reason as the line above: imported from the module, not the `Badge`
// barrel, which would drag NBadge, NIcon and the design provider into the
// `najm-kit/next` bundle for the sake of one context.
import { NBadgeDefaultsProvider } from "../components/Badge/defaults";
import type { NBadgeDefaults } from "../components/Badge/defaults";
import {
  NFeedbackDefaultsProvider,
  resolveFeedbackDefaultsValue,
} from "../components/feedback/feedbackDefaults";
import type { NFeedbackDefaults } from "../components/feedback/feedbackDefaults";
import {
  NajmPreferencesProvider,
  useNajmPreferencesContext,
  useNajmTheme,
} from "./preferences";
import type { NajmPreferencesProviderProps } from "./preferences";
import {
  buildPaginationLabels,
  DEFAULT_PAGINATION_KEY_PREFIX,
} from "./paginationLabels";
import type { NajmTranslate } from "./paginationLabels";
import {
  DEFAULT_TOOLBAR_KEY_PREFIX,
  buildToolbarLabels,
} from "./toolbarLabels";
import { useDocumentDirection, type NajmDirection } from "./useDocumentDirection";
import {
  EMPTY_DESIGN,
  NajmDesignEditorProvider,
  useNajmDesignEditor,
} from "./designEditor";

export interface NajmUIProviderProps
  extends Omit<NajmPreferencesProviderProps, "children"> {
  children: React.ReactNode;

  /**
   * The design config handed to `NajmDesignProvider`, owned by the application.
   *
   * Optional, and deliberately so: an application with no runtime theme editor
   * has nothing to put here, and requiring it was the only reason such an
   * application still had to author a provider file just to hold a constant.
   *
   * Prefer `initialDesign` for a theme editor. Passing `design` means the
   * application holds the draft state itself, which is the file this provider
   * exists to delete.
   */
  design?: NajmDesignConfig;
  /**
   * Seeds design state this provider owns from then on; ignored after mount.
   * A theme editor drives it through `useNajmDesignEditor`.
   */
  initialDesign?: NajmDesignConfig;
  /**
   * Forwarded to `NajmDesignProvider`, merged over a `min-h-full` default.
   *
   * The default is not decoration. `NajmThemeProvider` renders a real `div`
   * between the document body and the application, and a block box of
   * automatic height severs any `h-full` chain below it — every application
   * mounting this at the root was passing the same class back to repair that.
   * It is inert where it is not needed: a percentage `min-height` against an
   * auto-height parent imposes no constraint.
   *
   * Merged with `cn`, so a conflicting utility here still wins.
   */
  className?: string;

  /**
   * Translator for the pagination labels. Omit it and the packaged English
   * applies — the provider is still worth mounting for design and preferences.
   *
   * Memoize it. The labels are rebuilt whenever its identity changes, and
   * rebuilding them re-renders every table beneath.
   */
  t?: NajmTranslate;
  /** Catalog prefix for the labels. Defaults to `"common.pagination"`. */
  paginationKeyPrefix?: string;
  /**
   * Catalog prefix for the table toolbar and settings menu. Defaults to
   * `"common.table"`.
   *
   * These labels are built inside the kit rather than supplied per column, so
   * this prefix is the only way a catalog reaches the view-mode options, the
   * column-visibility heading, and the filter controls' accessible names.
   */
  toolbarKeyPrefix?: string;
  /**
   * Writing direction for the Radix popups beneath — menus, selects, and the
   * rest of the portaled content.
   *
   * Omit it and the direction follows `<html dir>`, which is what an
   * application already sets and what the browser lays the page out against.
   * Radix defaults its own context to `"ltr"` and stamps that on every portaled
   * element, so without this bridge an RTL page gets LTR popups. Pass a value
   * only to pin one region against the document.
   */
  dir?: NajmDirection;
  /**
   * Per-key overrides layered over the translated labels. Memoize it, for the
   * same reason as `t`.
   */
  tableDefaults?: NTableDefaults;
  /**
   * Presentation policy for `<NBadge status="…" />`: the look, the shape, and
   * the map from the application's status tokens to its catalog keys.
   *
   * This is the prop that deletes a project's `StatusBadge` wrapper. Memoize it
   * for the same reason as `t`.
   */
  badgeDefaults?: NBadgeDefaults;
  /**
   * Defaults for the shared feedback state components — loading, empty, error,
   * forbidden, and not-found. Each label resolves through the provider's `t`
   * the same way pagination and badge labels do, so the same translator
   * reaches every state without a second bridge.
   *
   * Memoize the object: a fresh identity rebuilds the resolved bundle and
   * re-renders every feedback state beneath.
   */
  feedbackDefaults?: NFeedbackDefaults;
}

type UICoreProps = Pick<
  NajmUIProviderProps,
  | "children"
  | "className"
  | "t"
  | "paginationKeyPrefix"
  | "toolbarKeyPrefix"
  | "dir"
  | "tableDefaults"
  | "badgeDefaults"
  | "feedbackDefaults"
>;

/**
 * Everything below preferences: design (which needs the live theme) and the
 * table defaults derived from the translator.
 *
 * Split out so `NajmUIProvider` can decide whether to mount a preferences
 * provider without making that decision from inside a conditional hook, and so
 * the design context can read the editor state mounted just above it.
 */
function NajmUICore({
  children,
  className,
  t,
  paginationKeyPrefix = DEFAULT_PAGINATION_KEY_PREFIX,
  toolbarKeyPrefix = DEFAULT_TOOLBAR_KEY_PREFIX,
  dir,
  tableDefaults,
  badgeDefaults,
  feedbackDefaults,
}: UICoreProps) {
  const { theme } = useNajmTheme();
  const direction = useDocumentDirection(dir);
  const design = useNajmDesignEditor()?.design ?? EMPTY_DESIGN;

  const defaults = React.useMemo<NTableDefaults>(() => {
    const translated = t
      ? buildPaginationLabels(t, paginationKeyPrefix)
      : undefined;
    const overrides = tableDefaults?.paginationLabels;

    // Per-key, most specific last, mirroring `useResolvedPaginationLabels`:
    // an explicit override wins, a translated label fills in behind it, and a
    // label neither supplies still reaches the packaged English downstream.
    const paginationLabels =
      translated || overrides ? { ...translated, ...overrides } : undefined;

    const translatedToolbar = t
      ? buildToolbarLabels(t, toolbarKeyPrefix)
      : undefined;
    const toolbarOverrides = tableDefaults?.toolbarLabels;
    const toolbarLabels =
      translatedToolbar || toolbarOverrides
        ? { ...translatedToolbar, ...toolbarOverrides }
        : undefined;

    return { ...tableDefaults, paginationLabels, toolbarLabels };
  }, [t, paginationKeyPrefix, toolbarKeyPrefix, tableDefaults]);

  const feedbackValue = React.useMemo(
    () => resolveFeedbackDefaultsValue(feedbackDefaults, t),
    [feedbackDefaults, t],
  );

  return (
    <NajmDesignProvider
      config={design}
      mode={theme}
      className={cn("min-h-full", className)}
    >
      {/* Radix reads direction from here and nowhere else. Without it every
          portaled menu and select renders LTR inside an RTL page. */}
      <DirectionProvider dir={direction}>
        <NTableDefaultsProvider value={defaults}>
          {/* Mounted unconditionally so the translator reaches the badges: an
              application can supply `statusLabelKeys` later, and a language
              change has to recompute labels through the same `t` the tables
              already use. */}
          <NBadgeDefaultsProvider defaults={badgeDefaults} t={t}>
            <NFeedbackDefaultsProvider value={feedbackValue}>
              {children}
            </NFeedbackDefaultsProvider>
          </NBadgeDefaultsProvider>
        </NTableDefaultsProvider>
      </DirectionProvider>
    </NajmDesignProvider>
  );
}

/**
 * The one provider a Najm application mounts for UI concerns.
 *
 * Composes three things that otherwise get copied between projects: theme and
 * time zone state with async persistence, a `NajmDesignProvider` fed the live
 * theme, and `NTable` pagination labels derived from the application's
 * translator.
 *
 * What it deliberately does not own: auth, react-query, and the translation
 * catalog. Those stay in the application — folding them in would make a UI
 * package depend on `najm-auth` and `@tanstack/react-query` and turn it into a
 * framework. Persistence is injected as callbacks so this entry imports
 * nothing from `next`; see `NajmNextUIProvider` in `najm-kit/next`.
 *
 * Rendering this under an existing `NajmPreferencesProvider` is supported: the
 * outer one wins and the preference props here are ignored. That is what lets
 * an application with a runtime theme editor hoist preferences above its
 * design context without forking this component.
 */
export function NajmUIProvider({
  children,
  design,
  initialDesign,
  className,
  t,
  paginationKeyPrefix,
  toolbarKeyPrefix,
  dir,
  tableDefaults,
  badgeDefaults,
  feedbackDefaults,
  initialTheme,
  initialTimeZone,
  onThemeChange,
  onTimeZoneChange,
  normalizeTimeZone,
}: NajmUIProviderProps) {
  const outerPreferences = useNajmPreferencesContext();

  const core = (
    <NajmDesignEditorProvider design={design} initialDesign={initialDesign}>
      <NajmUICore
        className={className}
        t={t}
        paginationKeyPrefix={paginationKeyPrefix}
        toolbarKeyPrefix={toolbarKeyPrefix}
        dir={dir}
        tableDefaults={tableDefaults}
        badgeDefaults={badgeDefaults}
        feedbackDefaults={feedbackDefaults}
      >
        {children}
      </NajmUICore>
    </NajmDesignEditorProvider>
  );

  if (outerPreferences) return core;

  return (
    <NajmPreferencesProvider
      initialTheme={initialTheme}
      initialTimeZone={initialTimeZone}
      onThemeChange={onThemeChange}
      onTimeZoneChange={onTimeZoneChange}
      normalizeTimeZone={normalizeTimeZone}
    >
      {core}
    </NajmPreferencesProvider>
  );
}

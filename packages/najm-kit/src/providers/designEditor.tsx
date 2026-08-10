import * as React from "react";

import type { NajmDesignConfig } from "../theme/design-types";

/**
 * Shared so the identity is stable across renders — `NajmDesignProvider`
 * memoizes on `config.components`, `config.typography` and `config.layout`, and
 * a fresh literal here would invalidate that on every render of the tree.
 */
export const EMPTY_DESIGN: NajmDesignConfig = Object.freeze({
  version: 1,
  theme: {},
  components: {},
}) as NajmDesignConfig;

export interface NajmDesignEditorValue {
  /** `draft ?? committed`. What the tree is currently rendered against. */
  design: NajmDesignConfig;
  /** The last design the application saved. */
  committed: NajmDesignConfig;
  /** The unsaved edit layered over `committed`, or `null`. */
  draft: NajmDesignConfig | null;
  hasDraft: boolean;
  /** Clones `committed` into a draft. A no-op while one is already open. */
  beginDraft: () => void;
  setDraft: (design: NajmDesignConfig) => void;
  cancelDraft: () => void;
  /** Adopt a design the application persisted, discarding any draft. */
  setCommitted: (design: NajmDesignConfig) => void;
}

const NajmDesignEditorContext =
  React.createContext<NajmDesignEditorValue | null>(null);

/**
 * The draft/commit layer a runtime theme editor needs.
 *
 * Returns `null` outside a provider, so a component that only *offers* theme
 * editing stays mountable in an application that has none.
 *
 * The editor holds no opinion about persistence: an application saves through
 * whatever its own API is, then hands the result back via `setCommitted`. That
 * is the same split `NajmPreferencesProvider` draws for theme and time zone.
 */
export function useNajmDesignEditor(): NajmDesignEditorValue | null {
  return React.useContext(NajmDesignEditorContext);
}

interface DesignState {
  committed: NajmDesignConfig;
  draft: NajmDesignConfig | null;
}

function cloneDesign(design: NajmDesignConfig): NajmDesignConfig {
  return structuredClone(design);
}

export interface NajmDesignEditorProviderProps {
  children: React.ReactNode;
  /**
   * Controlled design. When given, this provider only forwards it and every
   * command below is inert — the application already owns the state.
   */
  design?: NajmDesignConfig;
  /**
   * Seeds design state this provider owns from then on; ignored after mount.
   *
   * Uncontrolled on purpose, matching `initialTheme` and `initialTimeZone`:
   * the page is rendered once against what the server resolved, and every
   * change after that originates in the editor.
   */
  initialDesign?: NajmDesignConfig;
}

export function NajmDesignEditorProvider({
  children,
  design,
  initialDesign,
}: NajmDesignEditorProviderProps) {
  const [state, setState] = React.useState<DesignState>(() => ({
    committed: initialDesign ?? design ?? EMPTY_DESIGN,
    draft: null,
  }));

  const beginDraft = React.useCallback(() => {
    setState((current) =>
      current.draft
        ? current
        : { ...current, draft: cloneDesign(current.committed) },
    );
  }, []);

  const setDraft = React.useCallback((next: NajmDesignConfig) => {
    setState((current) => ({ ...current, draft: cloneDesign(next) }));
  }, []);

  const cancelDraft = React.useCallback(() => {
    setState((current) =>
      current.draft === null ? current : { ...current, draft: null },
    );
  }, []);

  // Guarded like `beginDraft` and `cancelDraft` above, and for a sharper
  // reason: a consumer that re-publishes the committed design from an effect
  // keyed on this provider's value — which is what `najm-theme` does to mirror
  // a saved design into the runtime — would otherwise loop forever. An
  // unconditional `setState` here produces a new state object, which produces a
  // new context value, which re-runs that effect, which calls this again.
  //
  // Only a call that changes nothing is skipped. Adopting a design while a
  // draft is open still clears the draft, because discarding it is the second
  // job this command has always done.
  const setCommitted = React.useCallback((next: NajmDesignConfig) => {
    setState((current) =>
      current.committed === next && current.draft === null
        ? current
        : { committed: next, draft: null },
    );
  }, []);

  const value = React.useMemo<NajmDesignEditorValue>(() => {
    if (design) {
      return {
        design,
        committed: design,
        draft: null,
        hasDraft: false,
        beginDraft: noop,
        setDraft: noop,
        cancelDraft: noop,
        setCommitted: noop,
      };
    }

    return {
      design: state.draft ?? state.committed,
      committed: state.committed,
      draft: state.draft,
      hasDraft: state.draft !== null,
      beginDraft,
      setDraft,
      cancelDraft,
      setCommitted,
    };
  }, [design, state, beginDraft, setDraft, cancelDraft, setCommitted]);

  return (
    <NajmDesignEditorContext.Provider value={value}>
      {children}
    </NajmDesignEditorContext.Provider>
  );
}

function noop() {}

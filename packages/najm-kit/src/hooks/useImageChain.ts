import * as React from "react";

import { selectImageSource } from "../lib/imageSource";

/**
 * The state that goes with `normalizeImageSources`: which candidate is being
 * displayed, whether it has loaded, and whether every candidate has failed.
 *
 * Deliberately not exported from the package. It is an implementation detail
 * shared by `NAvatar`, `NImage`, and `NNextImage`; a consumer wanting this
 * behavior should use one of those rather than rebuild it.
 */
export interface ImageChain {
  /**
   * The source to render. Once every candidate has failed this stays on the
   * last one rather than going undefined, so the element keeps its `src`
   * attribute and the browser issues no further request.
   */
  src: string | undefined;
  /** Every candidate has failed. */
  exhausted: boolean;
  /** The currently selected source has fired `load`. */
  loaded: boolean;
  /** Call from the element's `load` handler. */
  markLoaded: () => void;
  /** Call from the element's `error` handler. */
  markFailed: () => void;
}

const NO_FAILURES: readonly string[] = [];

interface ChainState {
  key: string;
  failed: readonly string[];
  loaded: string | null;
}

/**
 * Walks `sources` in order, advancing on each failure and never returning to a
 * source already known to be broken.
 *
 * Failure state is keyed by the source list, so changing `src`, `fallbackSrc`,
 * or the cache version discards stale failures and starts the chain over. The
 * reset happens during render rather than in an effect: an effect would paint
 * one frame of the new source against the old source's failure state, which is
 * the flicker where a fresh upload briefly shows the previous image's fallback.
 */
export function useImageChain(sources: readonly string[]): ImageChain {
  // JSON preserves source boundaries. Joining on a character that URLs may
  // legally contain can make two different candidate lists share stale state.
  const key = JSON.stringify(sources);
  const [state, setState] = React.useState<ChainState>(() => ({
    key,
    failed: NO_FAILURES,
    loaded: null,
  }));

  const fresh: ChainState = { key, failed: NO_FAILURES, loaded: null };
  const current = state.key === key ? state : fresh;
  if (state.key !== key) setState(fresh);

  const active = selectImageSource(sources, current.failed);

  const markLoaded = React.useCallback(() => {
    if (active === undefined) return;
    setState((prev) =>
      prev.key !== key || prev.loaded === active
        ? prev
        : { ...prev, loaded: active },
    );
  }, [key, active]);

  const markFailed = React.useCallback(() => {
    if (active === undefined) return;
    setState((prev) => {
      // Re-entering with a source already recorded returns the same object, so
      // an element that fires `error` twice cannot start a render loop.
      if (prev.key !== key || prev.failed.includes(active)) return prev;
      return {
        ...prev,
        failed: [...prev.failed, active],
        loaded: prev.loaded === active ? null : prev.loaded,
      };
    });
  }, [key, active]);

  return {
    src: active ?? sources[sources.length - 1],
    exhausted: sources.length > 0 && active === undefined,
    loaded: active !== undefined && current.loaded === active,
    markLoaded,
    markFailed,
  };
}

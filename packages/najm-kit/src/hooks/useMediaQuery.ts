import { useCallback, useSyncExternalStore } from "react";

/**
 * A media query read during render rather than after it.
 *
 * `matchMedia` answers synchronously, so the answer belongs in the render that
 * asks for it. Holding it in state and filling it from an effect makes every
 * mount paint one frame of the wrong viewport: on a desktop table page that
 * frame renders the card skeleton, which is then torn down for the table
 * skeleton, so a single load appears to load twice.
 *
 * `useSyncExternalStore` still uses `serverSnapshot` for SSR and for the
 * hydration render — nothing can be measured before the document exists — but
 * every render after that, including every client-side navigation, reads the
 * live value on its first pass.
 */
export function useMediaQuery(query: string, serverSnapshot = false): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverSnapshot,
  );
}

/**
 * The viewport width below which a table renders as cards. Matches the `lg`
 * breakpoint, which is where a row of table columns stops fitting.
 */
export const DEFAULT_CARD_BREAKPOINT = 1024;

/** Whether the viewport is narrow enough that a table should render as cards. */
export function useCardViewport(breakpoint = DEFAULT_CARD_BREAKPOINT): boolean {
  return useMediaQuery(`(max-width: ${breakpoint - 1}px)`);
}

/** The same decision as `useCardViewport`, as the mode name NTable takes. */
export function useDesktopTableMode(
  breakpoint = DEFAULT_CARD_BREAKPOINT,
): "table" | "cards" {
  return useMediaQuery(`(min-width: ${breakpoint}px)`) ? "table" : "cards";
}

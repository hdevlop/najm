import * as React from "react";

/**
 * Private compound state. It holds the menu's open state and a stable close
 * function and nothing else — notification rows stay in the application's own
 * server-state owner, never in package context.
 */
export interface NNotifyContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
}

const NNotifyContext = React.createContext<NNotifyContextValue | null>(null);

export const NNotifyProvider = NNotifyContext.Provider;

/** Context for parts that structurally require `NNotifyRoot`. */
export function useNNotifyContext(component: string): NNotifyContextValue {
  const value = React.useContext(NNotifyContext);
  if (!value) {
    throw new Error(`${component} must be rendered inside <NNotifyRoot>.`);
  }
  return value;
}

/**
 * Context for parts that only want to close the menu when there is one. They
 * stay usable on a full inbox page, outside any popover.
 */
export function useNNotifyClose(): (() => void) | undefined {
  const value = React.useContext(NNotifyContext);
  return value?.close;
}

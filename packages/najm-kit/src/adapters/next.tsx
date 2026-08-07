import React from 'react';
import { useRouter } from 'next/navigation';

import { NajmUIProvider } from '../providers';
import type { NajmUIProviderProps } from '../providers';
import type { NajmMode } from '../theme/types';

export interface NextLinkAdapterProps extends Record<string, any> {
  href: string;
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export function NextLinkAdapter({ children, ...props }: NextLinkAdapterProps) {
  return React.createElement('a', props, children);
}

export function useNextNavigationAdapter() {
  return {
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    push: (path: string) => {
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', path);
      }
    },
    replace: (path: string) => {
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', path);
      }
    },
  };
}

/** Where `NajmNextUIProvider` POSTs each preference. */
export interface NajmNextUIEndpoints {
  /** Defaults to `/api/ui-theme`. Receives `{ theme }`. */
  theme?: string;
  /** Defaults to `/api/ui-timezone`. Receives `{ timeZone }`. */
  timeZone?: string;
}

export interface NajmNextUIProviderProps
  extends Omit<NajmUIProviderProps, 'onThemeChange' | 'onTimeZoneChange'> {
  endpoints?: NajmNextUIEndpoints;
  /**
   * Call `router.refresh()` after a preference is persisted, so server
   * components re-render against the new cookie. Defaults to `true`.
   */
  refreshOnChange?: boolean;
}

const DEFAULT_THEME_ENDPOINT = '/api/ui-theme';
const DEFAULT_TIME_ZONE_ENDPOINT = '/api/ui-timezone';

async function postPreference(
  endpoint: string,
  body: Record<string, string>,
): Promise<void> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });

  // Throw rather than swallow. The state and the document have already been
  // updated optimistically, so a silent failure here is the case where the UI
  // and the cookie disagree until the next reload — the caller awaiting
  // `setTheme` is the only place left that can notice.
  if (!response.ok) {
    throw new Error(
      `Failed to persist preference to ${endpoint}: ${response.status}`,
    );
  }
}

/**
 * `NajmUIProvider` with the Next wiring supplied: preferences are POSTed to
 * cookie route handlers and the router is refreshed so server components see
 * the change.
 *
 * The route handlers are the application's — this package calls them, it does
 * not ship them. Each takes a JSON body (`{ theme }` / `{ timeZone }`), sets
 * its cookie, and returns any 2xx.
 *
 * This is the only module in the package that imports `next`, which is why
 * `next` is an *optional* peer dependency: consumers of the root entry never
 * reach this file.
 */
export function NajmNextUIProvider({
  endpoints,
  refreshOnChange = true,
  ...props
}: NajmNextUIProviderProps) {
  const router = useRouter();

  const themeEndpoint = endpoints?.theme ?? DEFAULT_THEME_ENDPOINT;
  const timeZoneEndpoint = endpoints?.timeZone ?? DEFAULT_TIME_ZONE_ENDPOINT;

  const onThemeChange = React.useCallback(
    async (theme: NajmMode) => {
      await postPreference(themeEndpoint, { theme });
      if (refreshOnChange) router.refresh();
    },
    [themeEndpoint, refreshOnChange, router],
  );

  const onTimeZoneChange = React.useCallback(
    async (timeZone: string) => {
      await postPreference(timeZoneEndpoint, { timeZone });
      if (refreshOnChange) router.refresh();
    },
    [timeZoneEndpoint, refreshOnChange, router],
  );

  return (
    <NajmUIProvider
      {...props}
      onThemeChange={onThemeChange}
      onTimeZoneChange={onTimeZoneChange}
    />
  );
}

import React from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import type { ImageProps } from 'next/image';

import { NajmUIProvider } from '../providers';
import type { NajmUIProviderProps } from '../providers';
import type { NajmMode } from '../theme/types';
import { normalizeImageSources } from '../lib/imageSource';
import { useImageChain } from '../hooks/useImageChain';

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

export interface NNextImageProps extends Omit<ImageProps, 'src' | 'onError'> {
  src: string;
  /** Swapped in once `src` fails to load. Tried exactly once. */
  fallbackSrc?: string;
  onError?: ImageProps['onError'];
}

/**
 * `next/image` with the fallback behavior of `NImage`, for applications that
 * want the optimizer, the layout reservation, and `fill`/`sizes`.
 *
 * Lives only in `najm-kit/next`. The root entry must stay installable without
 * Next, which is why this cannot be a prop on `NImage`.
 *
 * It classifies nothing. An application that serves an asset from a route the
 * browser must reach directly — an authenticated one, say — passes
 * `unoptimized` at the call site, because whether a route is protected is the
 * application's fact and not something a URL shape can be read for. Note also
 * what `unoptimized` is not: it changes delivery mechanics only. Session
 * validation, permissions, and what bytes come back remain entirely the
 * backend's.
 */
export function NNextImage({
  src,
  fallbackSrc,
  loading,
  priority,
  onError,
  ...props
}: NNextImageProps) {
  const chain = useImageChain(normalizeImageSources([src, fallbackSrc]));

  return (
    <NextImage
      {...props}
      priority={priority}
      // Next already lazy-loads by default, but stating it keeps the contract
      // the same as `NAvatar`'s. Left alone under `priority`, which Next treats
      // as mutually exclusive with an explicit `loading`.
      loading={loading ?? (priority ? undefined : 'lazy')}
      src={chain.src ?? src}
      onError={(event) => {
        chain.markFailed();
        onError?.(event);
      }}
    />
  );
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

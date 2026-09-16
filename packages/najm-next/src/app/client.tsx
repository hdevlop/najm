"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { HydrateSession, NajmAuthClient } from "najm-auth/client";
import { AuthProvider } from "najm-auth/client/react";
import {
  NajmKitProvider,
  type NajmKitProviderProps,
  type NajmKitSnapshot,
} from "najm-kit/app";
import type { PublicBranding } from "najm-theme";
import { NThemeBrandingProvider } from "najm-theme/react";
import * as React from "react";

import { defineNajmTanStackQuery } from "../query/tanstack";
import {
  NajmNextAppProvider,
  type NajmNextExtension,
  type NajmNextProviderBinding,
  type NajmNextProviderContext,
  type NajmNextQueryIntegration,
} from "./react";

export interface NajmClientAppSnapshot extends NajmKitSnapshot {
  readonly session: HydrateSession | null;
  readonly branding: PublicBranding;
}

type NajmClientUiProps = Omit<NajmKitProviderProps, "children" | "snapshot">;

export interface NajmClientAppContext<
  TSnapshot extends NajmClientAppSnapshot,
> {
  readonly snapshot: TSnapshot;
}

export interface NajmClientLocationIntegration<
  TSnapshot extends NajmClientAppSnapshot,
  TProps extends object,
> {
  readonly Provider: React.ComponentType<
    Readonly<TProps & { children: React.ReactNode }>
  >;
  readonly selectProps: (snapshot: TSnapshot) => TProps;
}

export type NajmAppProviderProps<
  TSnapshot extends NajmClientAppSnapshot,
  TLocationProps extends object = Record<string, never>,
> = NajmClientUiProps & {
  readonly authClient: NajmAuthClient;
  /** Uses Najm's TanStack defaults when omitted; pass false for no query layer. */
  readonly query?: NajmNextQueryIntegration<QueryClient> | false;
  readonly location?: NajmClientLocationIntegration<TSnapshot, TLocationProps>;
  readonly extensions?: NajmNextExtension<TSnapshot, QueryClient>;
  readonly snapshot: TSnapshot;
  readonly children: React.ReactNode;
};

export interface CreateNajmAppProviderOptions<
  TSnapshot extends NajmClientAppSnapshot,
  TLocationProps extends object = Record<string, never>,
> {
  readonly authClient: NajmAuthClient;
  /** Uses Najm's TanStack defaults when omitted; pass false for no query layer. */
  readonly query?: NajmNextQueryIntegration<QueryClient> | false;
  readonly location?: NajmClientLocationIntegration<TSnapshot, TLocationProps>;
  readonly extensions?: NajmNextExtension<TSnapshot, QueryClient>;
  /**
   * App-owned reactive UI values resolved inside Auth and Query. The hook is
   * called once, unconditionally, by the compatibility provider's UI layer.
   */
  readonly useUiProps?: (
    context: NajmClientAppContext<TSnapshot>,
  ) => Partial<NajmClientUiProps>;
}

export type NajmClientAppProviderProps<
  TSnapshot extends NajmClientAppSnapshot,
> = NajmClientUiProps & {
  readonly snapshot: TSnapshot;
  readonly children: React.ReactNode;
};

type UiPropsHook<TSnapshot extends NajmClientAppSnapshot> = (
  context: NajmClientAppContext<TSnapshot>,
) => Partial<NajmClientUiProps>;

interface ProviderRuntime<
  TSnapshot extends NajmClientAppSnapshot,
  TLocationProps extends object,
> {
  readonly authClient: NajmAuthClient;
  readonly location?: NajmClientLocationIntegration<TSnapshot, TLocationProps>;
  readonly uiProps: NajmClientUiProps;
  readonly useUiProps: UiPropsHook<TSnapshot>;
}

interface ProviderCoreProps<
  TSnapshot extends NajmClientAppSnapshot,
  TLocationProps extends object,
> extends NajmClientAppProviderProps<TSnapshot> {
  readonly authClient: NajmAuthClient;
  readonly query: NajmNextQueryIntegration<QueryClient> | undefined;
  readonly location?: NajmClientLocationIntegration<TSnapshot, TLocationProps>;
  readonly extensions?: NajmNextExtension<TSnapshot, QueryClient>;
  readonly useUiProps: UiPropsHook<TSnapshot>;
}

const DEFAULT_QUERY = defineNajmTanStackQuery();

function useEmptyUiProps(): Partial<NajmClientUiProps> {
  return {};
}

function sameQueryIntegration(
  previous: NajmNextQueryIntegration<QueryClient> | undefined,
  next: NajmNextQueryIntegration<QueryClient> | undefined,
): boolean {
  return (
    previous?.createClient === next?.createClient &&
    previous?.Provider === next?.Provider
  );
}

function NajmAppProviderCore<
  TSnapshot extends NajmClientAppSnapshot,
  TLocationProps extends object,
>({
  authClient,
  query,
  location,
  extensions,
  snapshot,
  children,
  useUiProps,
  ...uiProps
}: ProviderCoreProps<TSnapshot, TLocationProps>): React.JSX.Element {
  const lifetime = React.useRef({ authClient, query });
  if (lifetime.current.authClient !== authClient) {
    throw new TypeError(
      "najm-next/app/client: changing authClient requires remounting NajmAppProvider",
    );
  }
  if (!sameQueryIntegration(lifetime.current.query, query)) {
    throw new TypeError(
      "najm-next/app/client: changing Query integration requires remounting NajmAppProvider",
    );
  }

  const [composition] = React.useState(() => {
    type Context = NajmNextProviderContext<TSnapshot, QueryClient>;
    type LayerProps = Readonly<Context & { children: React.ReactNode }>;
    const RuntimeContext = React.createContext<
      ProviderRuntime<TSnapshot, TLocationProps> | undefined
    >(undefined);

    function useRuntime() {
      const value = React.useContext(RuntimeContext);
      if (!value) {
        throw new TypeError(
          "najm-next/app/client: internal provider runtime is unavailable",
        );
      }
      return value;
    }

    function AuthLayer({ children: nested, snapshot: current }: LayerProps) {
      const currentRuntime = useRuntime();
      return (
        <AuthProvider
          client={currentRuntime.authClient}
          initialSession={current.session}
        >
          {nested}
        </AuthProvider>
      );
    }

    function UiLayer({ children: nested, snapshot: current }: LayerProps) {
      const currentRuntime = useRuntime();
      const derivedUiProps = currentRuntime.useUiProps({ snapshot: current });
      return (
        <NajmKitProvider
          snapshot={current}
          {...derivedUiProps}
          {...currentRuntime.uiProps}
        >
          {nested}
        </NajmKitProvider>
      );
    }

    function BrandingLayer({ children: nested, snapshot: current }: LayerProps) {
      return (
        <NThemeBrandingProvider branding={current.branding}>
          {nested}
        </NThemeBrandingProvider>
      );
    }

    function LocationLayer({ children: nested, snapshot: current }: LayerProps) {
      const integration = useRuntime().location;
      if (!integration) return <>{nested}</>;
      const LocationProvider = integration.Provider;
      return (
        <LocationProvider {...integration.selectProps(current)}>
          {nested}
        </LocationProvider>
      );
    }

    return {
      RuntimeContext,
      providers: {
        auth: { Provider: AuthLayer },
        ui: { Provider: UiLayer },
        branding: { Provider: BrandingLayer },
        location: { Provider: LocationLayer },
      } satisfies Record<
        "auth" | "ui" | "branding" | "location",
        NajmNextProviderBinding<TSnapshot, QueryClient>
      >,
    };
  });

  const runtime = { authClient, location, uiProps, useUiProps };
  const RuntimeContext = composition.RuntimeContext;

  return (
    <RuntimeContext.Provider value={runtime}>
      <NajmNextAppProvider
        snapshot={snapshot}
        query={query}
        providers={composition.providers}
        extensions={extensions}
      >
        {children}
      </NajmNextAppProvider>
    </RuntimeContext.Provider>
  );
}

/**
 * The recommended full application provider. Auth, Query, Kit UI, Theme
 * branding, extensions and location share the low-level Najm composition
 * engine while normal snapshot and UI prop updates remain reactive.
 */
export function NajmAppProvider<
  TSnapshot extends NajmClientAppSnapshot,
  TLocationProps extends object = Record<string, never>,
>({
  authClient,
  query = DEFAULT_QUERY,
  location,
  extensions,
  ...props
}: NajmAppProviderProps<TSnapshot, TLocationProps>): React.JSX.Element {
  return (
    <NajmAppProviderCore
      {...props}
      authClient={authClient}
      query={query === false ? undefined : query}
      location={location}
      extensions={extensions}
      useUiProps={useEmptyUiProps}
    />
  );
}

/**
 * @deprecated Mount `NajmAppProvider` directly. The factory remains for
 * applications that need the captured `useUiProps` compatibility hook.
 */
export function createNajmAppProvider<
  TSnapshot extends NajmClientAppSnapshot,
  TLocationProps extends object = Record<string, never>,
>(
  options: CreateNajmAppProviderOptions<TSnapshot, TLocationProps>,
): React.ComponentType<NajmClientAppProviderProps<TSnapshot>> {
  const query =
    options.query === false ? undefined : (options.query ?? DEFAULT_QUERY);
  const useUiProps = options.useUiProps ?? useEmptyUiProps;

  function CompatibilityNajmAppProvider(
    props: NajmClientAppProviderProps<TSnapshot>,
  ) {
    return (
      <NajmAppProviderCore
        {...props}
        authClient={options.authClient}
        query={query}
        location={options.location}
        extensions={options.extensions}
        useUiProps={useUiProps}
      />
    );
  }

  CompatibilityNajmAppProvider.displayName = "NajmAppProvider";
  return CompatibilityNajmAppProvider;
}

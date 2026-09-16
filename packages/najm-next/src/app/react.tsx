"use client";

import * as React from "react";

/** Values a provider binding may read without importing server code. */
export interface NajmNextProviderContext<TSnapshot, TQueryClient = unknown> {
  readonly snapshot: TSnapshot;
  readonly queryClient: TQueryClient | undefined;
}

/**
 * One client provider already owned by an installed package or application.
 *
 * The integration layer deliberately stores a render component rather than
 * importing Auth, Query, Kit, Theme, Leaflet, or Google itself. Consumers bind
 * only the providers they installed, so a config-only/minimal app has no
 * optional dependency edge and every React context still comes from its
 * original package instance.
 */
export interface NajmNextProviderBinding<TSnapshot, TQueryClient = unknown> {
  readonly Provider: React.ComponentType<
    Readonly<
      NajmNextProviderContext<TSnapshot, TQueryClient> & {
        children: React.ReactNode;
      }
    >
  >;
}

/** Explicit app-extension positions in the stable provider order. */
export interface NajmNextExtension<TSnapshot, TQueryClient = unknown> {
  /** Inside Query and outside UI (School's keyboard shortcuts). */
  readonly beforeUi?: NajmNextProviderBinding<TSnapshot, TQueryClient>;
  /** Inside UI/branding and outside location/application children. */
  readonly insideUi?: NajmNextProviderBinding<TSnapshot, TQueryClient>;
}

export interface NajmNextProviderSet<TSnapshot, TQueryClient = unknown> {
  readonly auth?: NajmNextProviderBinding<TSnapshot, TQueryClient>;
  readonly query?: NajmNextProviderBinding<TSnapshot, TQueryClient>;
  readonly ui?: NajmNextProviderBinding<TSnapshot, TQueryClient>;
  readonly branding?: NajmNextProviderBinding<TSnapshot, TQueryClient>;
  readonly location?: NajmNextProviderBinding<TSnapshot, TQueryClient>;
}

/**
 * Optional state/cache integration that owns one client and its matching
 * provider. Leaf adapters can implement this without making their dependency
 * part of the generic Najm Next client entrypoint.
 */
export interface NajmNextQueryIntegration<TQueryClient> {
  readonly createClient: () => TQueryClient;
  readonly Provider: React.ComponentType<
    Readonly<{ client: TQueryClient; children: React.ReactNode }>
  >;
}

export interface NajmNextAppProviderProps<TSnapshot, TQueryClient = unknown> {
  /** Public, serializable request snapshot only. */
  readonly snapshot: TSnapshot;
  /** Optional query integration. Mutually exclusive with the legacy query props. */
  readonly query?: NajmNextQueryIntegration<TQueryClient>;
  /** @deprecated Prefer a leaf query integration through `query`. */
  readonly queryClient?: TQueryClient;
  /** @deprecated Prefer a leaf query integration through `query`. */
  readonly createQueryClient?: () => TQueryClient;
  readonly providers: NajmNextProviderSet<TSnapshot, TQueryClient>;
  readonly extensions?: NajmNextExtension<TSnapshot, TQueryClient>;
  readonly children: React.ReactNode;
}

/**
 * Bind a concrete package provider with fully inferred props.
 *
 * Define bindings at module scope in the application's client-only provider
 * file. `resolveProps` is evaluated inside the composed client render and may
 * read only the public snapshot/query client passed to it.
 */
export function bindNajmNextProvider<
  TSnapshot,
  TQueryClient,
  TProps extends object,
>(
  Component: React.ComponentType<TProps & { children: React.ReactNode }>,
  resolveProps: (context: NajmNextProviderContext<TSnapshot, TQueryClient>) => TProps,
): NajmNextProviderBinding<TSnapshot, TQueryClient> {
  if (typeof Component !== "function" && typeof Component !== "object") {
    throw new TypeError("najm-next/app/react: provider component is required");
  }
  if (typeof resolveProps !== "function") {
    throw new TypeError("najm-next/app/react: resolveProps must be a function");
  }

  function BoundProvider({
    children,
    ...context
  }: Readonly<
    NajmNextProviderContext<TSnapshot, TQueryClient> & {
      children: React.ReactNode;
    }
  >) {
    return <Component {...resolveProps(context)}>{children}</Component>;
  }

  return Object.freeze({ Provider: BoundProvider });
}

function wrap<TSnapshot, TQueryClient>(
  binding: NajmNextProviderBinding<TSnapshot, TQueryClient> | undefined,
  context: NajmNextProviderContext<TSnapshot, TQueryClient>,
  children: React.ReactNode,
): React.ReactNode {
  if (!binding) return children;
  const { Provider } = binding;
  return <Provider {...context}>{children}</Provider>;
}

interface QueryLifetime<TQueryClient> {
  readonly mode: "none" | "integration" | "external" | "owned";
  readonly client?: TQueryClient;
  readonly createClient?: () => TQueryClient;
  readonly Provider?: React.ComponentType<
    Readonly<{ client: TQueryClient; children: React.ReactNode }>
  >;
  readonly bindingProvider?: NajmNextProviderBinding<
    unknown,
    TQueryClient
  >["Provider"];
}

function queryLifetime<TSnapshot, TQueryClient>(
  query: NajmNextQueryIntegration<TQueryClient> | undefined,
  queryClient: TQueryClient | undefined,
  createQueryClient: (() => TQueryClient) | undefined,
  queryBinding: NajmNextProviderBinding<TSnapshot, TQueryClient> | undefined,
): QueryLifetime<TQueryClient> {
  if (query) {
    return {
      mode: "integration",
      createClient: query.createClient,
      Provider: query.Provider,
    };
  }
  if (queryClient !== undefined) {
    return {
      mode: "external",
      client: queryClient,
      bindingProvider: queryBinding?.Provider,
    };
  }
  if (createQueryClient) {
    return {
      mode: "owned",
      createClient: createQueryClient,
      bindingProvider: queryBinding?.Provider,
    };
  }
  return { mode: "none", bindingProvider: queryBinding?.Provider };
}

function sameQueryLifetime<TQueryClient>(
  previous: QueryLifetime<TQueryClient>,
  next: QueryLifetime<TQueryClient>,
): boolean {
  return (
    previous.mode === next.mode &&
    previous.client === next.client &&
    previous.createClient === next.createClient &&
    previous.Provider === next.Provider &&
    previous.bindingProvider === next.bindingProvider
  );
}

/**
 * Compose enabled providers once in this fixed order:
 *
 * Auth → Query → beforeUi → UI → Branding → insideUi → Location → children.
 *
 * The order preserves School's keyboard placement and lets location labels
 * consume the UI i18n provider. Kafil can keep its reactive settings
 * subscription in a bound UI component, where Query is already available.
 */
export function NajmNextAppProvider<TSnapshot, TQueryClient = unknown>({
  snapshot,
  query,
  queryClient,
  createQueryClient,
  providers,
  extensions,
  children,
}: NajmNextAppProviderProps<TSnapshot, TQueryClient>): React.JSX.Element {
  if (
    query !== undefined &&
    (queryClient !== undefined ||
      createQueryClient !== undefined ||
      providers.query !== undefined)
  ) {
    throw new TypeError(
      "najm-next/app/react: pass query integration or legacy query props, not both",
    );
  }
  if (queryClient !== undefined && createQueryClient !== undefined) {
    throw new TypeError(
      "najm-next/app/react: pass queryClient or createQueryClient, not both",
    );
  }
  const currentQueryLifetime = queryLifetime(
    query,
    queryClient,
    createQueryClient,
    providers.query,
  );
  const mountedQueryLifetime = React.useRef(currentQueryLifetime);
  if (!sameQueryLifetime(mountedQueryLifetime.current, currentQueryLifetime)) {
    throw new TypeError(
      "najm-next/app/react: changing Query mode, client, constructor, or provider requires remounting NajmNextAppProvider",
    );
  }
  const createOwnedQueryClient = query?.createClient ?? createQueryClient;
  const [ownedQueryClient] = React.useState<TQueryClient | undefined>(() =>
    queryClient === undefined ? createOwnedQueryClient?.() : undefined,
  );
  const activeQueryClient = queryClient ?? ownedQueryClient;
  const context = React.useMemo(
    () => ({ snapshot, queryClient: activeQueryClient }),
    [activeQueryClient, snapshot],
  );

  let tree: React.ReactNode = children;
  tree = wrap(providers.location, context, tree);
  tree = wrap(extensions?.insideUi, context, tree);
  tree = wrap(providers.branding, context, tree);
  tree = wrap(providers.ui, context, tree);
  tree = wrap(extensions?.beforeUi, context, tree);
  if (query !== undefined && activeQueryClient !== undefined) {
    const QueryProvider = query.Provider;
    tree = <QueryProvider client={activeQueryClient}>{tree}</QueryProvider>;
  } else {
    tree = wrap(providers.query, context, tree);
  }
  tree = wrap(providers.auth, context, tree);

  return <>{tree}</>;
}

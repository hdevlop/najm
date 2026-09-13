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

export interface NajmNextAppProviderProps<TSnapshot, TQueryClient = unknown> {
  /** Public, serializable request snapshot only. */
  readonly snapshot: TSnapshot;
  /** App-created QueryClient. Mutually exclusive with `createQueryClient`. */
  readonly queryClient?: TQueryClient;
  /** Called once for this mounted application, never on the server globally. */
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
  queryClient,
  createQueryClient,
  providers,
  extensions,
  children,
}: NajmNextAppProviderProps<TSnapshot, TQueryClient>): React.JSX.Element {
  const [ownedQueryClient] = React.useState<TQueryClient | undefined>(() =>
    queryClient === undefined ? createQueryClient?.() : undefined,
  );
  if (queryClient !== undefined && createQueryClient !== undefined) {
    throw new TypeError(
      "najm-next/app/react: pass queryClient or createQueryClient, not both",
    );
  }
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
  tree = wrap(providers.query, context, tree);
  tree = wrap(providers.auth, context, tree);

  return <>{tree}</>;
}

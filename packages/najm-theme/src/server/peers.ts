// ============================================================================
// najm-theme/server — optional peer resolution
// ============================================================================
//
// `najm-storage` and `najm-mcp` are optional peers: the plugin reaches them
// only when `assetUploads` or `mcp` is on. Both are resolved from the container
// at activation, and both are resolved *by symbol*.
//
// Why not by class, which is the convention everywhere else in Najm:
//
// A constructor is only a usable DI token while every participant holds the
// same one. Inside a package that always holds. Across a package boundary it
// does not. This package ships as `dist`, so its `import "najm-storage"`
// resolves through `node_modules` to `najm-storage/dist`. An application in
// this monorepo maps the same specifier through a tsconfig path to
// `packages/najm-storage/src`. Same source, two module instances, two
// constructors — and `container.resolve(StorageService)` handed the wrong one
// does not fail. It *succeeds*, building a second service that shares no
// configuration with the application's, and the failure surfaces much later as
// files written to the wrong provider or MCP tools that register into a
// registry nothing serves.
//
// `Symbol.for` is keyed by string in a process-wide registry, so both copies
// produce the identical symbol. The container is a single instance for the
// process (one `diject` install, one static singleton), and each plugin aliases
// its symbol to its own class — so resolving the symbol reaches the one service
// the application actually booted, whichever copy asked for it.
//
// The strings are duplicated here rather than imported. Importing them would
// load a second copy of the peer package to read a value whose whole purpose is
// to be independent of which copy is loaded, and would make an optional peer's
// module graph a hard cost of this file. `test/server/peers.test.ts` pins them
// against the symbols the peer packages actually export.
// ============================================================================

import type { Container } from "najm-core";

// Typed `symbol` rather than left to infer `unique symbol`. A `unique symbol`
// is a nominal type — TypeScript would treat this declaration and the peer
// package's as incompatible types for the one value they are both guaranteed to
// produce. Being shared is the point of these; being unique is what they are
// specifically not.

/** Mirrors `MCP_REGISTRY` in `najm-mcp/src/tokens.ts`. */
export const MCP_REGISTRY_TOKEN: symbol = Symbol.for("najm:mcp:registry");

/** Mirrors `STORAGE_SERVICE` in `najm-storage/src/tokens.ts`. */
export const STORAGE_SERVICE_TOKEN: symbol = Symbol.for("najm:storage:service");

export interface PeerRequirement {
  /** The npm package that owns the token. */
  packageName: string;
  /** The theme feature that made this peer necessary. */
  feature: string;
  /** The registration the consumer is missing, written as they would write it. */
  registration: string;
}

/**
 * Resolve an optional peer's service through its identity-stable token.
 *
 * Only "the token is not registered" is translated into a configuration error.
 * A peer that *is* registered and fails while constructing throws whatever it
 * threw: swallowing that would report a missing plugin to someone whose plugin
 * is present and broken, which is a worse place to start debugging than the
 * original stack.
 */
export async function resolvePeerService<T>(
  container: Container,
  token: symbol,
  requirement: PeerRequirement,
): Promise<T> {
  if (!container.has(token)) {
    throw new Error(
      `[najm-theme] theme.features.${requirement.feature} is enabled but ${requirement.packageName} is not registered. ` +
        `Add ${requirement.registration} before .use(theme({ … })). ` +
        `If ${requirement.packageName} is not installed: bun add ${requirement.packageName}`,
    );
  }

  return (await container.resolve(token)) as T;
}

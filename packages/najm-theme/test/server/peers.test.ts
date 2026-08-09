import "reflect-metadata";
import { describe, expect, it } from "bun:test";

import { Container, Service } from "najm-core";
import { MCP_REGISTRY } from "najm-mcp";
import { STORAGE_SERVICE } from "najm-storage";

import {
  MCP_REGISTRY_TOKEN,
  STORAGE_SERVICE_TOKEN,
  resolvePeerService,
} from "../../src/server/peers";

// ============================================================================
// Optional peers are resolved by symbol, and this is why.
//
// The failure these tests exist for produced no error at all: `theme` MCP tools
// registered into a registry that was never served, and branding uploads
// resolved a storage service the application had never configured. Both came
// from resolving a *class* across a package boundary, where the class this
// package imports and the class the application booted are two different
// objects with the same name.
// ============================================================================

describe("peer tokens", () => {
  // `src/server/peers.ts` re-declares these strings instead of importing them,
  // so that an optional peer's module graph is not a hard cost of loading this
  // package. That trade is only safe while the strings match — which is what
  // this asserts, against the symbols the peer packages really export.
  it("matches the symbol najm-mcp exports", () => {
    expect(MCP_REGISTRY_TOKEN).toBe(MCP_REGISTRY);
  });

  it("matches the symbol najm-storage exports", () => {
    expect(STORAGE_SERVICE_TOKEN).toBe(STORAGE_SERVICE);
  });

  it("uses the process-wide symbol registry, which is what makes them stable", () => {
    // Two copies of a module each calling `Symbol.for` with the same key get
    // the identical symbol; two copies each declaring a class do not.
    expect(MCP_REGISTRY_TOKEN).toBe(Symbol.for("najm:mcp:registry"));
    expect(STORAGE_SERVICE_TOKEN).toBe(Symbol.for("najm:storage:service"));
    expect(Symbol("najm:mcp:registry")).not.toBe(MCP_REGISTRY_TOKEN);
  });
});

describe("resolvePeerService", () => {
  const requirement = {
    packageName: "najm-storage",
    feature: "assetUploads",
    registration: ".use(storage({ … }))",
  };

  it("resolves the aliased singleton, not a second instance", async () => {
    @Service()
    class RealPeerService {
      readonly id = Symbol("real");
    }

    const container = Container.create();
    container.set([RealPeerService]);
    container.alias(STORAGE_SERVICE_TOKEN, RealPeerService);

    const viaClass = await container.resolve(RealPeerService);
    const viaToken = await resolvePeerService<RealPeerService>(
      container,
      STORAGE_SERVICE_TOKEN,
      requirement,
    );

    expect(viaToken).toBe(viaClass);
  });

  it("explains the missing registration rather than reporting a DI token", async () => {
    const container = Container.create();

    const error = (await resolvePeerService(container, STORAGE_SERVICE_TOKEN, requirement).catch(
      (thrown: unknown) => thrown,
    )) as Error;

    expect(error.message).toContain("assetUploads");
    expect(error.message).toContain("najm-storage");
    expect(error.message).toContain(".use(storage({ … }))");
  });

  it("does not swallow a registered peer's own construction failure", async () => {
    @Service()
    class BrokenPeerService {
      constructor() {
        throw new Error("provider credentials are missing");
      }
    }

    const container = Container.create();
    container.set([BrokenPeerService]);
    container.alias(STORAGE_SERVICE_TOKEN, BrokenPeerService);

    const error = (await resolvePeerService(container, STORAGE_SERVICE_TOKEN, requirement).catch(
      (thrown: unknown) => thrown,
    )) as Error;

    // The old code caught everything and reported "najm-storage is not
    // registered", sending anyone who hit this to check a plugin list that was
    // already correct.
    expect(error.message).toContain("provider credentials are missing");
    expect(error.message).not.toContain(".use(storage({ … }))");
  });
});

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { isThemeRevisionConflict } from "../../src/contracts/revisions";
import { FACTORY_DESIGN, makeHarness, type Harness } from "./harness";

let harness: Harness;

beforeEach(() => {
  harness = makeHarness();
});

afterEach(() => {
  harness.close();
});

const SCOPE = "platform";

describe("reads", () => {
  it("serves the factory design at revision 1 before anything is stored", async () => {
    const appearance = await harness.appearance.getPublic(SCOPE);
    expect(appearance.designConfig).toEqual(FACTORY_DESIGN);
    expect(appearance.revision).toBe(1);
  });

  it("marks an untouched scope as factory in the admin projection", async () => {
    const admin = await harness.appearance.getAdmin(SCOPE);
    expect(admin.isFactory).toBe(true);
    expect(admin.updatedAt).toBeNull();
    expect(admin.updatedByActorId).toBeNull();
  });

  it("keeps provenance out of the public projection", async () => {
    await harness.appearance.save({
      scopeId: SCOPE,
      actorId: "u_1",
      expectedRevision: 1,
      patch: { theme: { tokens: { primary: "#ff0000" } } },
    });

    const publicRead = await harness.appearance.getPublic(SCOPE);
    expect(Object.keys(publicRead).sort()).toEqual(["designConfig", "revision"]);
    expect(JSON.stringify(publicRead)).not.toContain("u_1");
  });
});

describe("save", () => {
  it("increments the revision by exactly one, including on the first write", async () => {
    const first = await harness.appearance.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      patch: { theme: { tokens: { primary: "#ff0000" } } },
    });
    expect(first.revision).toBe(2);

    const second = await harness.appearance.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 2,
      patch: { theme: { tokens: { primary: "#00ff00" } } },
    });
    expect(second.revision).toBe(3);
  });

  it("merges group by group, keeping what the patch did not mention", async () => {
    const saved = await harness.appearance.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      patch: { typography: { fontSans: "Roboto" } },
    });

    expect(saved.designConfig.typography).toEqual({ fontSans: "Roboto" });
    expect(saved.designConfig.theme).toEqual(FACTORY_DESIGN.theme);
  });

  it("rejects an unsafe design and stores nothing", async () => {
    await expect(
      harness.appearance.save({
        scopeId: SCOPE,
        actorId: null,
        expectedRevision: 1,
        patch: { theme: { tokens: { primary: "url(https://evil.test)" } } },
      }),
    ).rejects.toThrow(/url\(\)/);

    expect((await harness.appearance.getAdmin(SCOPE)).isFactory).toBe(true);
    expect((await harness.appearance.getPublic(SCOPE)).revision).toBe(1);
  });

  it("records the actor on the row", async () => {
    await harness.appearance.save({
      scopeId: SCOPE,
      actorId: "u_42",
      expectedRevision: 1,
      patch: { theme: { tokens: {} } },
    });
    expect((await harness.appearance.getAdmin(SCOPE)).updatedByActorId).toBe("u_42");
  });
});

describe("reset", () => {
  it("stores the factory state and still moves the revision", async () => {
    await harness.appearance.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      patch: { theme: { tokens: { primary: "#ff0000" } } },
    });

    const reset = await harness.appearance.reset({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 2,
    });

    expect(reset.revision).toBe(3);
    expect(reset.designConfig).toEqual(FACTORY_DESIGN);

    const admin = await harness.appearance.getAdmin(SCOPE);
    expect(admin.isFactory).toBe(true);
    // Not a deleted row: a client still holding revision 2 must fail cleanly
    // rather than re-saving the design that was just discarded.
    expect(admin.revision).toBe(3);
  });

  it("makes a client that was editing the pre-reset design conflict", async () => {
    await harness.appearance.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      patch: { theme: { tokens: { primary: "#ff0000" } } },
    });
    await harness.appearance.reset({ scopeId: SCOPE, actorId: null, expectedRevision: 2 });

    await expect(
      harness.appearance.save({
        scopeId: SCOPE,
        actorId: null,
        expectedRevision: 2,
        patch: { theme: { tokens: { primary: "#0000ff" } } },
      }),
    ).rejects.toThrow(/modified by someone else/);
  });
});

describe("conflicts", () => {
  it("lets exactly one of two writers from the same revision commit", async () => {
    const write = (primary: string) =>
      harness.appearance.save({
        scopeId: SCOPE,
        actorId: null,
        expectedRevision: 1,
        patch: { theme: { tokens: { primary } } },
      });

    const results = await Promise.allSettled([write("#ff0000"), write("#00ff00")]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(isThemeRevisionConflict((rejected[0] as PromiseRejectedResult).reason)).toBe(true);
    expect((await harness.appearance.getPublic(SCOPE)).revision).toBe(2);
  });

  it("reports the revision it expected and the one it found", async () => {
    await harness.appearance.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      patch: { theme: { tokens: {} } },
    });

    try {
      await harness.appearance.save({
        scopeId: SCOPE,
        actorId: null,
        expectedRevision: 1,
        patch: { theme: { tokens: {} } },
      });
      throw new Error("expected a conflict");
    } catch (error) {
      expect(isThemeRevisionConflict(error)).toBe(true);
      expect((error as { expectedRevision: number }).expectedRevision).toBe(1);
      expect((error as { actualRevision: number }).actualRevision).toBe(2);
      expect((error as { resource: string }).resource).toBe("appearance");
    }
  });

  it("conflicts when a client claims a revision for a scope that has no row", async () => {
    await expect(
      harness.appearance.save({
        scopeId: SCOPE,
        actorId: null,
        expectedRevision: 7,
        patch: { theme: { tokens: {} } },
      }),
    ).rejects.toThrow(/modified by someone else/);
  });

  it("rejects a revision that is not a positive integer before touching the database", async () => {
    for (const expectedRevision of [0, -1, 1.5]) {
      await expect(
        harness.appearance.save({
          scopeId: SCOPE,
          actorId: null,
          expectedRevision,
          patch: { theme: { tokens: {} } },
        }),
      ).rejects.toThrow(/expectedRevision/);
    }
  });
});

describe("stored-config recovery", () => {
  it("falls back to the factory design and reports why, without echoing the payload", async () => {
    harness.sqlite.exec(`
      INSERT INTO najm_theme_appearance (scope_id, design_config, revision, created_at, updated_at)
      VALUES ('platform', '{"version":1,"theme":{"tokens":{"primary":"url(https://evil.test/leak)"}}}', 4, '2026-01-01', '2026-01-01')
    `);

    const appearance = await harness.appearance.getPublic(SCOPE);
    expect(appearance.designConfig).toEqual(FACTORY_DESIGN);
    // The revision is the stored one, so a client editing against it still gets
    // a clean conflict rather than silently overwriting an unreadable row.
    expect(appearance.revision).toBe(4);

    const diagnostic = harness.diagnostics.find(
      (entry) => entry.code === "appearance.invalid-stored-config",
    );
    expect(diagnostic).toBeDefined();
    expect(JSON.stringify(diagnostic)).not.toContain("evil.test");
  });
});

describe("audit", () => {
  it("records the action, actor, scope, and revision transition", async () => {
    await harness.appearance.save({
      scopeId: SCOPE,
      actorId: "u_9",
      expectedRevision: 1,
      patch: { typography: { fontSans: "Roboto" } },
    });

    const [event] = harness.audits;
    expect(event.action).toBe("theme.appearance.saved");
    expect(event.actorId).toBe("u_9");
    expect(event.scopeId).toBe(SCOPE);
    expect(event.fromRevision).toBe(1);
    expect(event.toRevision).toBe(2);
    expect(event.metadata).toEqual({ kind: "appearance-save", changedGroups: ["typography"] });
  });

  it("names changed groups but never carries their values", async () => {
    await harness.appearance.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      patch: { theme: { tokens: { primary: "#abcdef" } } },
    });

    expect(JSON.stringify(harness.audits)).not.toContain("#abcdef");
  });

  it("does not record anything for a mutation that failed", async () => {
    await expect(
      harness.appearance.save({
        scopeId: SCOPE,
        actorId: null,
        expectedRevision: 5,
        patch: { theme: { tokens: {} } },
      }),
    ).rejects.toThrow();
    expect(harness.audits).toHaveLength(0);
  });

  it("keeps a failing post-commit sink from failing a committed save", async () => {
    const failing = makeHarness({
      audit: {
        record: () => {
          throw new Error("audit service is down");
        },
      },
    });

    try {
      const saved = await failing.appearance.save({
        scopeId: SCOPE,
        actorId: null,
        expectedRevision: 1,
        patch: { theme: { tokens: {} } },
      });
      expect(saved.revision).toBe(2);
      expect(failing.diagnostics.some((entry) => entry.code === "audit.sink-failed")).toBe(true);
    } finally {
      failing.close();
    }
  });
});

describe("scope isolation", () => {
  it("keeps two scopes' designs and revisions independent", async () => {
    await harness.appearance.save({
      scopeId: "acme",
      actorId: null,
      expectedRevision: 1,
      patch: { theme: { tokens: { primary: "#ff0000" } } },
    });

    expect((await harness.appearance.getPublic("acme")).revision).toBe(2);
    expect((await harness.appearance.getPublic("globex")).revision).toBe(1);
    expect((await harness.appearance.getPublic("globex")).designConfig).toEqual(FACTORY_DESIGN);
  });
});

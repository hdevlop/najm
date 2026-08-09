import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { isThemeRevisionConflict } from "../../src/contracts/revisions";
import { makeHarness, type Harness } from "./harness";

let harness: Harness;

beforeEach(() => {
  harness = makeHarness();
});

afterEach(() => {
  harness.close();
});

const SCOPE = "platform";

const design = (primary: string) => ({
  version: 1 as const,
  theme: { tokens: { primary } },
});

describe("create", () => {
  it("stores a preset with a Unicode-safe slug", async () => {
    const preset = await harness.presets.create({
      scopeId: SCOPE,
      actorId: "u_1",
      name: "مظهر الشتاء",
      designConfig: design("#ff0000"),
    });

    expect(preset.slug).toBe("مظهر-الشتاء");
    expect(preset.name).toBe("مظهر الشتاء");
    expect(preset.isBuiltIn).toBe(false);
  });

  it("disambiguates two presets whose names slug identically", async () => {
    const first = await harness.presets.create({
      scopeId: SCOPE,
      actorId: null,
      name: "Winter Theme",
      designConfig: design("#ff0000"),
    });
    const second = await harness.presets.create({
      scopeId: SCOPE,
      actorId: null,
      name: "winter  theme",
      designConfig: design("#00ff00"),
    });

    expect(first.slug).toBe("winter-theme");
    expect(second.slug).toBe("winter-theme-2");
  });

  it("lets the same slug exist in two scopes", async () => {
    const acme = await harness.presets.create({
      scopeId: "acme",
      actorId: null,
      name: "Winter",
      designConfig: design("#ff0000"),
    });
    const globex = await harness.presets.create({
      scopeId: "globex",
      actorId: null,
      name: "Winter",
      designConfig: design("#00ff00"),
    });

    expect(acme.slug).toBe("winter");
    expect(globex.slug).toBe("winter");
  });

  it("validates the design through the same policy appearance uses", async () => {
    await expect(
      harness.presets.create({
        scopeId: SCOPE,
        actorId: null,
        name: "Sneaky",
        designConfig: { version: 1, theme: { tokens: { primary: "url(https://evil.test)" } } },
      }),
    ).rejects.toThrow(/url\(\)/);

    expect(await harness.presets.list(SCOPE)).toHaveLength(0);
  });

  it("rejects a blank name", async () => {
    await expect(
      harness.presets.create({
        scopeId: SCOPE,
        actorId: null,
        name: "   ",
        designConfig: design("#ff0000"),
      }),
    ).rejects.toThrow(/must not be blank/);
  });

  it("enforces the limit", async () => {
    const limited = makeHarness({ limits: { maxPresets: 2 } });
    try {
      await limited.presets.create({
        scopeId: SCOPE,
        actorId: null,
        name: "One",
        designConfig: design("#ff0000"),
      });
      await limited.presets.create({
        scopeId: SCOPE,
        actorId: null,
        name: "Two",
        designConfig: design("#00ff00"),
      });

      await expect(
        limited.presets.create({
          scopeId: SCOPE,
          actorId: null,
          name: "Three",
          designConfig: design("#0000ff"),
        }),
      ).rejects.toThrow(/maximum of 2 theme presets/);

      expect(await limited.presets.list(SCOPE)).toHaveLength(2);
    } finally {
      limited.close();
    }
  });

  it("counts the limit per scope", async () => {
    const limited = makeHarness({ limits: { maxPresets: 1 } });
    try {
      await limited.presets.create({
        scopeId: "acme",
        actorId: null,
        name: "One",
        designConfig: design("#ff0000"),
      });
      await expect(
        limited.presets.create({
          scopeId: "globex",
          actorId: null,
          name: "One",
          designConfig: design("#ff0000"),
        }),
      ).resolves.toBeDefined();
    } finally {
      limited.close();
    }
  });
});

describe("list", () => {
  it("is scoped", async () => {
    await harness.presets.create({
      scopeId: "acme",
      actorId: null,
      name: "Acme",
      designConfig: design("#ff0000"),
    });

    expect(await harness.presets.list("acme")).toHaveLength(1);
    expect(await harness.presets.list("globex")).toHaveLength(0);
  });

  it("omits a preset whose stored design no longer validates, and says so once", async () => {
    await harness.presets.create({
      scopeId: SCOPE,
      actorId: null,
      name: "Good",
      designConfig: design("#ff0000"),
    });
    harness.sqlite.exec(`
      INSERT INTO najm_theme_presets (id, scope_id, slug, name, design_config, is_built_in, created_at, updated_at)
      VALUES ('11111111-1111-4111-8111-111111111111', 'platform', 'bad', 'Bad',
              '{"version":1,"theme":{"tokens":{"primary":"url(https://evil.test)"}}}', 0, '2026-01-01', '2026-01-01')
    `);

    const presets = await harness.presets.list(SCOPE);
    expect(presets.map((preset) => preset.slug)).toEqual(["good"]);

    const diagnostic = harness.diagnostics.find((entry) => entry.code === "preset.invalid-design");
    expect(diagnostic?.detail).toContain("bad");
    expect(JSON.stringify(diagnostic)).not.toContain("evil.test");
  });
});

describe("apply", () => {
  it("replaces the whole design and moves the appearance revision", async () => {
    await harness.appearance.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      patch: { typography: { fontSans: "Roboto" }, theme: { tokens: { primary: "#111111" } } },
    });

    const preset = await harness.presets.create({
      scopeId: SCOPE,
      actorId: null,
      name: "Minimal",
      designConfig: design("#ff0000"),
    });

    const applied = await harness.presets.apply({
      scopeId: SCOPE,
      actorId: "u_1",
      presetId: preset.id,
      expectedRevision: 2,
    });

    expect(applied.revision).toBe(3);
    expect(applied.designConfig.theme.tokens?.primary).toBe("#ff0000");
    // A replace, not a merge: the typography the preset does not define is gone.
    expect(applied.designConfig.typography).toBeUndefined();
  });

  it("uses the appearance lock, so a stale editor conflicts", async () => {
    const preset = await harness.presets.create({
      scopeId: SCOPE,
      actorId: null,
      name: "Minimal",
      designConfig: design("#ff0000"),
    });
    await harness.appearance.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      patch: { theme: { tokens: {} } },
    });

    try {
      await harness.presets.apply({
        scopeId: SCOPE,
        actorId: null,
        presetId: preset.id,
        expectedRevision: 1,
      });
      throw new Error("expected a conflict");
    } catch (error) {
      expect(isThemeRevisionConflict(error)).toBe(true);
    }
  });

  it("refuses to apply another scope's preset", async () => {
    const preset = await harness.presets.create({
      scopeId: "acme",
      actorId: null,
      name: "Acme",
      designConfig: design("#ff0000"),
    });

    await expect(
      harness.presets.apply({
        scopeId: "globex",
        actorId: null,
        presetId: preset.id,
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/was not found/);

    expect((await harness.appearance.getPublic("globex")).revision).toBe(1);
  });

  it("records the preset on the appearance audit event", async () => {
    const preset = await harness.presets.create({
      scopeId: SCOPE,
      actorId: null,
      name: "Minimal",
      designConfig: design("#ff0000"),
    });
    harness.audits.length = 0;

    await harness.presets.apply({
      scopeId: SCOPE,
      actorId: "u_2",
      presetId: preset.id,
      expectedRevision: 1,
    });

    const [event] = harness.audits;
    expect(event.action).toBe("theme.appearance.preset-applied");
    expect(event.metadata).toEqual({
      kind: "appearance-preset",
      presetId: preset.id,
      presetSlug: "minimal",
    });
  });
});

describe("delete", () => {
  it("removes a user preset", async () => {
    const preset = await harness.presets.create({
      scopeId: SCOPE,
      actorId: null,
      name: "Temp",
      designConfig: design("#ff0000"),
    });

    await harness.presets.delete({ scopeId: SCOPE, actorId: null, presetId: preset.id });
    expect(await harness.presets.list(SCOPE)).toHaveLength(0);
  });

  it("refuses another scope's preset", async () => {
    const preset = await harness.presets.create({
      scopeId: "acme",
      actorId: null,
      name: "Acme",
      designConfig: design("#ff0000"),
    });

    await expect(
      harness.presets.delete({ scopeId: "globex", actorId: null, presetId: preset.id }),
    ).rejects.toThrow(/was not found/);
    expect(await harness.presets.list("acme")).toHaveLength(1);
  });

  it("protects a built-in preset by default", async () => {
    const preset = await harness.presets.create({
      scopeId: SCOPE,
      actorId: null,
      name: "Shipped",
      designConfig: design("#ff0000"),
      isBuiltIn: true,
    });

    await expect(
      harness.presets.delete({ scopeId: SCOPE, actorId: null, presetId: preset.id }),
    ).rejects.toThrow(/built in and cannot be deleted/);
  });

  it("allows it when the installation opted in — the same answer the UI is told", async () => {
    const permissive = makeHarness({ limits: { allowBuiltInPresetDeletion: true } });
    try {
      const preset = await permissive.presets.create({
        scopeId: SCOPE,
        actorId: null,
        name: "Shipped",
        designConfig: design("#ff0000"),
        isBuiltIn: true,
      });

      await permissive.presets.delete({ scopeId: SCOPE, actorId: null, presetId: preset.id });
      expect(await permissive.presets.list(SCOPE)).toHaveLength(0);
      expect(permissive.config.limits.allowBuiltInPresetDeletion).toBe(true);
    } finally {
      permissive.close();
    }
  });

  it("records the deletion without the design", async () => {
    const preset = await harness.presets.create({
      scopeId: SCOPE,
      actorId: null,
      name: "Temp",
      designConfig: design("#abcdef"),
    });
    harness.audits.length = 0;

    await harness.presets.delete({ scopeId: SCOPE, actorId: "u_3", presetId: preset.id });

    const [event] = harness.audits;
    expect(event.action).toBe("theme.preset.deleted");
    expect(event.actorId).toBe("u_3");
    expect(JSON.stringify(event)).not.toContain("#abcdef");
  });
});

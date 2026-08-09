import { describe, expect, it } from "bun:test";

import {
  assertFeatureDependencies,
  capabilitiesFor,
} from "../../src/contracts/capabilities";
import { reportDiagnostic, describeThrown } from "../../src/contracts/diagnostics";
import {
  INITIAL_THEME_REVISION,
  ThemeRevisionConflictError,
  assertThemeRevision,
  isThemeRevision,
  isThemeRevisionConflict,
  nextThemeRevision,
} from "../../src/contracts/revisions";
import {
  DEFAULT_THEME_SCOPE_ID,
  THEME_SCOPE_ID_MAX_LENGTH,
  assertThemeScopeId,
  isThemeScopeId,
  platformScope,
} from "../../src/contracts/scope";

describe("scope ids", () => {
  it("accepts ordinary tenant keys", () => {
    for (const id of ["platform", "acme", "tenant-42", "a_b", "A1"]) {
      expect(isThemeScopeId(id)).toBe(true);
    }
  });

  it("rejects anything that could escape a storage namespace or a URL path", () => {
    for (const id of ["", "../x", "a/b", "a\\b", "a.b", "-lead", "_lead", "a b", "a%2f"]) {
      expect(isThemeScopeId(id)).toBe(false);
    }
  });

  it("rejects an over-long id", () => {
    expect(isThemeScopeId("a".repeat(THEME_SCOPE_ID_MAX_LENGTH))).toBe(true);
    expect(isThemeScopeId("a".repeat(THEME_SCOPE_ID_MAX_LENGTH + 1))).toBe(false);
  });

  it("throws rather than coercing, so two ids cannot collapse into one", () => {
    expect(() => assertThemeScopeId("acme/")).toThrow(/scopeId must be/);
    expect(assertThemeScopeId("acme")).toBe("acme");
  });

  it("resolves the default scope without configuration", async () => {
    const resolved = await platformScope({ request: new Request("http://x.test/") });
    expect(resolved).toBe(DEFAULT_THEME_SCOPE_ID);
  });
});

describe("revisions", () => {
  it("accepts positive safe integers only", () => {
    expect(isThemeRevision(1)).toBe(true);
    expect(isThemeRevision(0)).toBe(false);
    expect(isThemeRevision(-1)).toBe(false);
    expect(isThemeRevision(1.5)).toBe(false);
    expect(isThemeRevision(Number.MAX_SAFE_INTEGER + 2)).toBe(false);
    expect(isThemeRevision("1")).toBe(false);
  });

  it("starts at one and increments by exactly one", () => {
    expect(INITIAL_THEME_REVISION).toBe(1);
    expect(nextThemeRevision(1)).toBe(2);
    expect(nextThemeRevision(41)).toBe(42);
  });

  it("throws at the safe-integer ceiling instead of producing a value that compares equal", () => {
    expect(() => nextThemeRevision(Number.MAX_SAFE_INTEGER)).toThrow(/safe integer range/);
  });

  it("reports its label on a bad value", () => {
    expect(() => assertThemeRevision(0, "expectedRevision")).toThrow(/expectedRevision/);
  });

  it("carries both revisions on a conflict so a client can tell how far behind it is", () => {
    const error = new ThemeRevisionConflictError("appearance", 3, 7);
    expect(error.expectedRevision).toBe(3);
    expect(error.actualRevision).toBe(7);
    expect(error.resource).toBe("appearance");
    expect(isThemeRevisionConflict(error)).toBe(true);
    expect(isThemeRevisionConflict(new Error("nope"))).toBe(false);
  });
});

describe("features and capabilities", () => {
  const features = {
    appearance: true,
    branding: true,
    presets: true,
    assetUploads: true,
    mcp: false,
  };

  it("requires appearance for presets", () => {
    expect(() =>
      assertFeatureDependencies({ ...features, appearance: false, branding: false, assetUploads: false }),
    ).toThrow(/presets requires features.appearance/);
  });

  it("requires branding for asset uploads", () => {
    expect(() => assertFeatureDependencies({ ...features, branding: false })).toThrow(
      /assetUploads requires features.branding/,
    );
  });

  it("projects capabilities from enabled features", () => {
    expect(capabilitiesFor(features)).toEqual({
      readAppearance: true,
      manageAppearance: true,
      readBranding: true,
      manageBranding: true,
      uploadBrandingAssets: true,
      readPresets: true,
      managePresets: true,
    });

    expect(capabilitiesFor({ ...features, assetUploads: false }).uploadBrandingAssets).toBe(false);
  });
});

describe("diagnostics", () => {
  it("summarizes an Error and refuses to stringify anything else", () => {
    expect(describeThrown(new TypeError("bad"))).toBe("TypeError: bad");
    expect(describeThrown({ body: "secret", cookie: "session=1" })).toBe("non-error thrown: object");
    expect(describeThrown("literal")).toBe("non-error thrown: string");
  });

  it("does not let a broken sink take the recovery path down with it", () => {
    expect(() =>
      reportDiagnostic(
        () => {
          throw new Error("pager is down");
        },
        { code: "appearance.invalid-stored-config" },
      ),
    ).not.toThrow();
  });

  it("is inert without a sink", () => {
    expect(() => reportDiagnostic(undefined, { code: "audit.sink-failed" })).not.toThrow();
  });
});

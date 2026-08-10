import { afterAll, describe, expect, it } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { defineTheme, isNajmThemeDefinition } from "../../src/theme";
import {
  FACTORY_BRANDING_FILES,
  parseFactoryAssetFileName,
} from "../../src/contracts/factory";

// ============================================================================
// The factory theme convention, against real directories on a real disk.
//
// Three committed fixtures cover the three shapes a consumer can legitimately
// ship — all PNG, all WebP, and a mix — because "the package accepts WebP" and
// "the package serves WebP with the right content type" are different claims
// and only the second one keeps a logo from downloading instead of rendering.
//
// Every rejection case is built in a temp directory from those same bytes. A
// committed fixture of a *broken* theme is a file somebody eventually fixes.
// ============================================================================

const FIXTURES = join(import.meta.dir, "../fixtures");
const PNG_DIR = join(FIXTURES, "theme-png");
const WEBP_DIR = join(FIXTURES, "theme-webp");
const MIXED_DIR = join(FIXTURES, "theme-mixed");

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

/** A copy of a valid fixture, for a test that needs to break exactly one thing. */
function scratchTheme(from = PNG_DIR): string {
  const dir = mkdtempSync(join(tmpdir(), "najm-theme-"));
  temporary.push(dir);

  mkdirSync(dir, { recursive: true });
  copyFileSync(join(from, "theme.json"), join(dir, "theme.json"));
  for (const basename of Object.keys(FACTORY_BRANDING_FILES)) {
    for (const extension of ["png", "webp"]) {
      try {
        copyFileSync(join(from, `${basename}.${extension}`), join(dir, `${basename}.${extension}`));
      } catch {
        // The fixture ships one extension per basename; the other is expected
        // to be absent.
      }
    }
  }

  return dir;
}

describe("a valid factory theme directory", () => {
  it("loads an all-PNG directory", () => {
    const definition = defineTheme(PNG_DIR);

    expect(isNajmThemeDefinition(definition)).toBe(true);
    expect(definition.assets.map((asset) => asset.slot).sort()).toEqual([
      "authHeroImage",
      "authLogo",
      "sidebarLogoCollapsed",
      "sidebarLogoExpanded",
    ]);
    expect(definition.assets.every((asset) => asset.mimeType === "image/png")).toBe(true);
    expect(definition.appearance().theme?.tokens?.primary).toBe("#0ea5e9");
  });

  it("loads an all-WebP directory", () => {
    const definition = defineTheme(WEBP_DIR);

    expect(definition.assets.every((asset) => asset.mimeType === "image/webp")).toBe(true);
    expect(definition.assets.every((asset) => asset.extension === "webp")).toBe(true);
  });

  it("loads a mixed directory and keeps each file's own type", () => {
    const definition = defineTheme(MIXED_DIR);

    const bySlot = Object.fromEntries(
      definition.assets.map((asset) => [asset.slot, asset.mimeType]),
    );
    expect(bySlot.sidebarLogoExpanded).toBe("image/png");
    expect(bySlot.sidebarLogoCollapsed).toBe("image/webp");
    expect(bySlot.authLogo).toBe("image/webp");
    expect(bySlot.authHeroImage).toBe("image/png");
  });

  it("accepts a module URL, which is what a consumer actually passes", () => {
    // `import.meta.url` names the *file*; the definition is the directory it
    // sits in. Proven with a real file URL rather than a path so the
    // `file://` + Windows-drive-letter round trip is covered too.
    const moduleUrl = pathToFileURL(join(PNG_DIR, "index.ts")).href;
    expect(defineTheme(moduleUrl).dir.replace(/\\/g, "/")).toBe(PNG_DIR.replace(/\\/g, "/"));
  });
});

describe("immutability", () => {
  it("hands out a fresh design per read and cannot be edited through one", () => {
    const definition = defineTheme(PNG_DIR);

    const first = definition.appearance();
    const second = definition.appearance();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.theme).not.toBe(second.theme);

    first.theme!.tokens!.primary = "#ef4444";
    expect(definition.appearance().theme?.tokens?.primary).toBe("#0ea5e9");
  });

  it("freezes the asset list and every asset in it", () => {
    const definition = defineTheme(PNG_DIR);

    expect(Object.isFrozen(definition.assets)).toBe(true);
    expect(Object.isFrozen(definition.assets[0])).toBe(true);
    expect(Object.isFrozen(definition)).toBe(true);
  });
});

describe("branding paths", () => {
  it("builds one URL per slot under the mount the browser sees", () => {
    const branding = defineTheme(MIXED_DIR).branding("/api/theme");

    for (const [slot, path] of Object.entries(branding)) {
      expect(path).toStartWith("/api/theme/branding/factory/");
      const parsed = parseFactoryAssetFileName(path!.split("/").pop());
      expect(parsed?.slot).toBe(slot);
    }
  });

  it("defaults to the standard mount", () => {
    const branding = defineTheme(PNG_DIR).branding();
    expect(branding.sidebarLogoExpanded).toStartWith("/api/theme/branding/factory/");
  });

  it("puts the content hash in the name, so a changed file is a changed URL", () => {
    const dir = scratchTheme();
    const before = defineTheme(dir).branding("/api/theme").sidebarLogoExpanded;

    copyFileSync(
      join(WEBP_DIR, "sidebar-logo-expanded.webp"),
      join(dir, "sidebar-logo-expanded.webp"),
    );
    rmSync(join(dir, "sidebar-logo-expanded.png"));

    const after = defineTheme(dir).branding("/api/theme").sidebarLogoExpanded;
    expect(after).not.toBe(before);
  });

  it("rejects a mount prefix that is not an absolute path", () => {
    expect(() => defineTheme(PNG_DIR).branding("api/theme")).toThrow(/absolute path/);
  });
});

describe("serving", () => {
  it("serves the bytes with the file's own type, length, and an immutable cache", async () => {
    const definition = defineTheme(MIXED_DIR);
    const asset = definition.asset("authLogo")!;

    const response = definition.serveAsset(asset.fileName)!;
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("content-length")).toBe(String(asset.bytes));
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("etag")).toBe(`"${asset.contentHash}"`);

    const body = new Uint8Array(await response.arrayBuffer());
    expect(Buffer.from(body).equals(readFileSync(asset.sourcePath))).toBe(true);
  });

  it("honours a configured cache lifetime", () => {
    const definition = defineTheme(PNG_DIR);
    const response = definition.serveAsset(definition.assets[0].fileName, { cacheMaxAge: 60 })!;
    expect(response.headers.get("cache-control")).toBe("public, max-age=60, immutable");
  });

  it("refuses everything that is not one of the four current names", () => {
    const definition = defineTheme(PNG_DIR);
    const asset = definition.asset("authLogo")!;

    for (const candidate of [
      "../../etc/passwd",
      "..%2F..%2Ftheme.json",
      "theme.json",
      "authLogo.png",
      // A real slot with a stale hash: the file it named is not the file the
      // build ships, so it is as unknown as any other name.
      `authLogo.${"0".repeat(16)}.png`,
      asset.fileName.replace(".png", ".webp").replace(".webp", ".jpg"),
      undefined,
      null,
      42,
    ]) {
      expect(definition.serveAsset(candidate)).toBeNull();
    }
  });
});

describe("configuration failures", () => {
  it("names the missing file", () => {
    const dir = scratchTheme();
    rmSync(join(dir, "auth-hero.png"));

    expect(() => defineTheme(dir)).toThrow(/auth-hero\.png or auth-hero\.webp/);
  });

  it("refuses an ambiguous pair rather than picking one", () => {
    const dir = scratchTheme();
    copyFileSync(join(WEBP_DIR, "auth-logo.webp"), join(dir, "auth-logo.webp"));

    expect(() => defineTheme(dir)).toThrow(/contains both auth-logo\.png and auth-logo\.webp/);
  });

  it("refuses a file whose bytes disagree with its extension", () => {
    const dir = scratchTheme();
    // A real WebP under a .png name — the exact file a designer produces by
    // renaming an export, and the one that would be served as image/png.
    copyFileSync(join(WEBP_DIR, "auth-logo.webp"), join(dir, "auth-logo.png"));

    expect(() => defineTheme(dir)).toThrow(/is a image\/webp file with a \.png name/);
  });

  it("refuses bytes that are not an image at all", () => {
    const dir = scratchTheme();
    writeFileSync(join(dir, "auth-logo.png"), "<html><script>alert(1)</script></html>");

    expect(() => defineTheme(dir)).toThrow(/not a readable PNG or WebP image/);
  });

  it("refuses an asset over the slot ceiling", () => {
    const dir = scratchTheme();
    expect(() => defineTheme(dir, { limits: { logoBytes: 512 } })).toThrow(
      /sidebarLogoExpanded accepts at most 512/,
    );
  });

  it("refuses a ceiling above the package maximum", () => {
    expect(() => defineTheme(PNG_DIR, { limits: { heroBytes: 64 * 1024 * 1024 } })).toThrow(
      /no greater than/,
    );
  });

  it("names the file when theme.json is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "najm-theme-"));
    temporary.push(dir);

    expect(() => defineTheme(dir)).toThrow(/theme\.json is missing/);
  });

  it("names the file when theme.json is malformed", () => {
    const dir = scratchTheme();
    writeFileSync(join(dir, "theme.json"), "{ not json");

    expect(() => defineTheme(dir)).toThrow(/is not valid JSON/);
  });

  it("holds theme.json to the same safety rules a stored design passes", () => {
    const dir = scratchTheme();
    writeFileSync(
      join(dir, "theme.json"),
      JSON.stringify({ version: 1, theme: { tokens: { primary: "url(https://example.invalid)" } } }),
    );

    expect(() => defineTheme(dir)).toThrow(/url\(\)/);
  });

  it("honours an explicit appearance ceiling", () => {
    expect(() =>
      defineTheme(PNG_DIR, { limits: { appearance: { maxDesignBytes: 40 } } }),
    ).toThrow(/at most 40 bytes/);
  });

  it("refuses a source that is neither a module URL nor a path", () => {
    expect(() => defineTheme("")).toThrow(/requires the calling module's URL/);
  });
});

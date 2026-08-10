import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// ============================================================================
// Source-boundary assertion: a standard consumer carries no theme plumbing.
//
// The contract this guards:
//
//   ```ts
//   // app/serverTheme.ts
//   const serverTheme = appTheme.react({ getServer });
//   export const loadServerTheme = serverTheme.load;
//   export const loadServerAppearance = serverTheme.loadAppearance;
//   export const loadServerBranding = serverTheme.loadBranding;
//
//   // app/layout.tsx
//   <NThemeBrandingProvider branding={branding}>
//     {children}
//   </NThemeBrandingProvider>
//
//   // app/dashboard/theme/ThemeSettingsSurface.tsx
//   <NThemeSettingsProvider onPersisted={refresh}>
//     <NThemeSettings />
//   </NThemeSettingsProvider>
//   ```
//
// Every name in those files is owned by the package, the application, or
// React/Next. Anything else — a factory map prop, a baseUrl literal, a
// `'/api/theme'` string, a `branding(...)` call against the definition — is a
// regression of the closeout this test exists to enforce.
//
// The Playground and the Next 16 fixture are the two reference consumers.
// Anything else in the worktree that imports the consumer-facing entries
// (`najm-theme/react`, `najm-theme/theme`) is checked too. The server-side
// plugin registration entry (`najm-theme/server`) is excluded because that
// file legitimately holds the theme's application-side configuration.
// ============================================================================

const ROOT = resolve(import.meta.dir, "../../../..");
const PLAYGROUND = resolve(ROOT, "apps/playground");
const FIXTURE = resolve(ROOT, "packages/najm-theme/integration/next16/fixture");

function read(rel: string): string {
  return readFileSync(resolve(PLAYGROUND, rel), "utf8");
}

function readFixture(rel: string): string {
  return readFileSync(resolve(FIXTURE, rel), "utf8");
}

/** Files that import the consumer-facing entries (`react` or `theme`). */
function listConsumerImports(): string[] {
  const grep = (dir: string): string[] => {
    const result: string[] = [];
    const glob = new Bun.Glob("**/*.{ts,tsx}");
    for (const file of glob.scanSync({ cwd: dir, onlyFiles: true })) {
      const source = readFileSync(resolve(dir, file), "utf8");
      if (
        /from\s+["']najm-theme\/react["']/.test(source) ||
        /from\s+["']najm-theme\/theme["']/.test(source) ||
        /from\s+["']najm-theme["'](?!\/)/.test(source)
      ) {
        result.push(resolve(dir, file));
      }
    }
    return result;
  };

  return [...grep(PLAYGROUND), ...grep(FIXTURE)];
}

describe("playground standard consumer files", () => {
  const files = [
    "src/lib/serverTheme.ts",
    "src/app/layout.tsx",
    "src/components/theme/themeSettingsSurface.tsx",
  ] as const;

  for (const file of files) {
    if (!existsSync(resolve(PLAYGROUND, file))) continue;
    const source = read(file);
    describe(file, () => {
      it("does not name a factory map prop", () => {
        expect(source).not.toMatch(/\bfactory\s*=\s*\{/);
      });
      it("does not name a baseUrl override", () => {
        expect(source).not.toMatch(/\bbaseUrl\s*[:=]/);
      });
      it("does not contain a /api/theme literal in code", () => {
        // Strip line and block comments before checking — explanatory prose
        // is allowed to name the standard mount; it just cannot be code.
        const stripped = source
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/[^\n]*/g, "");
        expect(stripped).not.toContain("/api/theme");
      });
      it("does not call appTheme.branding(...) to build a consumer-side map", () => {
        expect(source).not.toMatch(/appTheme\.branding\(/);
      });
    });
  }
});

describe("next16 fixture standard consumer files", () => {
  const files = [
    "src/serverTheme.ts",
    "src/app/page.tsx",
    "src/app/layout.tsx",
    "src/app/nested/page.tsx",
    "src/app/nested/layout.tsx",
    "theme/index.ts",
  ] as const;

  for (const file of files) {
    if (!existsSync(resolve(FIXTURE, file))) continue;
    const source = readFixture(file);
    describe(file, () => {
      it("does not name a factory map prop", () => {
        expect(source).not.toMatch(/\bfactory\s*=\s*\{/);
      });
      it("does not name a baseUrl override", () => {
        expect(source).not.toMatch(/\bbaseUrl\s*[:=]/);
      });
      it("does not contain a /api/theme literal in code", () => {
        const stripped = source
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/[^\n]*/g, "");
        expect(stripped).not.toContain("/api/theme");
      });
    });
  }
});

describe("every file that imports the consumer-facing entries", () => {
  // Patterns that catch theme-specific factory/path/baseUrl usage. These are
  // intentionally loose enough that a regression of the closeout is caught,
  // but the file list above is intentionally limited to consumer-facing
  // imports so non-theme `basePath`/`baseUrl` for unrelated plugins does not
  // false-positive here.
  const forbidden: { pattern: RegExp; what: string }[] = [
    { pattern: /\bfactory\s*=\s*\{/, what: "a factory map prop" },
    { pattern: /\bbaseUrl\s*[:=]/, what: "a baseUrl override" },
    { pattern: /["']\/api\/theme["']/, what: "the /api/theme literal" },
    { pattern: /\bappTheme\.branding\(/, what: "an appTheme.branding() call" },
  ];

  for (const file of listConsumerImports()) {
    const source = readFileSync(file, "utf8");
    // Strip comments — prose is allowed to name the convention.
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

    describe(file.replace(ROOT, "<root>"), () => {
      for (const { pattern, what } of forbidden) {
        it(`does not contain ${what}`, () => {
          expect(stripped).not.toMatch(pattern);
        });
      }
    });
  }
});
import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const packageRoot = resolve(__dirname, "..", "..");
const themeCssPath = resolve(packageRoot, "src", "theme.css");
const distThemeCssPath = resolve(packageRoot, "dist", "theme.css");

describe("theme.css — source-level checks", () => {
  test("theme.css exists at src/theme.css", () => {
    expect(existsSync(themeCssPath)).toBe(true);
  });

  test("theme.css has no --najm- color/radius variable references in source", () => {
    const src = readFileSync(themeCssPath, "utf-8");
    const matches = src.match(/--najm-[\w-]+/g) ?? [];
    expect(matches).toEqual([]);
  });

  test("first real statement is @import tw-animate-css", () => {
    const src = readFileSync(themeCssPath, "utf-8");
    const lines = src.split(/\n/);
    const firstReal = lines.find((l) => l.trimStart().startsWith("@import "));
    expect(firstReal).toBeTruthy();
    expect(firstReal!.trim()).toBe('@import "tw-animate-css";');
  });

  test("@source directive points to ./", () => {
    const src = readFileSync(themeCssPath, "utf-8");
    expect(src).toMatch(/@source\s+["']\.\/["']/);
  });

  test("@custom-variant dark follows shadcn pattern", () => {
    const src = readFileSync(themeCssPath, "utf-8");
    expect(src).toMatch(/@custom-variant\s+dark\s+\(&:where\(\.dark,\s*\.dark\s*\*\)\)/);
  });

  test("@theme inline maps --color-X to var(--X) (unprefixed)", () => {
    const src = readFileSync(themeCssPath, "utf-8");
    const expectedMappings = [
      "--color-background: var(--background)",
      "--color-foreground: var(--foreground)",
      "--color-card: var(--card)",
      "--color-card-foreground: var(--card-foreground)",
      "--color-popover: var(--popover)",
      "--color-popover-foreground: var(--popover-foreground)",
      "--color-primary: var(--primary)",
      "--color-primary-foreground: var(--primary-foreground)",
      "--color-secondary: var(--secondary)",
      "--color-secondary-foreground: var(--secondary-foreground)",
      "--color-tertiary: var(--tertiary)",
      "--color-tertiary-foreground: var(--tertiary-foreground)",
      "--color-muted: var(--muted)",
      "--color-muted-foreground: var(--muted-foreground)",
      "--color-accent: var(--accent)",
      "--color-accent-foreground: var(--accent-foreground)",
      "--color-destructive: var(--destructive)",
      "--color-destructive-foreground: var(--destructive-foreground)",
      "--color-border: var(--border)",
      "--color-input: var(--input)",
      "--color-ring: var(--ring)",
      "--color-sidebar: var(--sidebar)",
      "--color-sidebar-foreground: var(--sidebar-foreground)",
      "--color-sidebar-primary: var(--sidebar-primary)",
      "--color-sidebar-primary-foreground: var(--sidebar-primary-foreground)",
      "--color-sidebar-accent: var(--sidebar-accent)",
      "--color-sidebar-accent-foreground: var(--sidebar-accent-foreground)",
      "--color-sidebar-border: var(--sidebar-border)",
      "--color-sidebar-ring: var(--sidebar-ring)",
      "--color-chart-1: var(--chart-1)",
      "--color-chart-2: var(--chart-2)",
      "--color-chart-3: var(--chart-3)",
      "--color-chart-4: var(--chart-4)",
      "--color-chart-5: var(--chart-5)",
    ];
    for (const m of expectedMappings) {
      expect(src).toContain(m);
    }
  });

  test("@theme inline maps radius scale to var(--radius)", () => {
    const src = readFileSync(themeCssPath, "utf-8");
    expect(src).toMatch(/--radius-sm:\s*calc\(var\(--radius\)\s*-\s*4px\)/);
    expect(src).toMatch(/--radius-md:\s*calc\(var\(--radius\)\s*-\s*2px\)/);
    expect(src).toMatch(/--radius-lg:\s*var\(--radius\)/);
    expect(src).toMatch(/--radius-xl:\s*calc\(var\(--radius\)\s*\+\s*4px\)/);
    expect(src).toMatch(/--radius-2xl:\s*calc\(var\(--radius\)\s*\+\s*8px\)/);
    expect(src).toMatch(/--radius-3xl:\s*calc\(var\(--radius\)\s*\+\s*12px\)/);
    expect(src).toMatch(/--radius-4xl:\s*calc\(var\(--radius\)\s*\+\s*16px\)/);
  });

  test(":root defines the full shadcn set with oklch values", () => {
    const src = readFileSync(themeCssPath, "utf-8");
    const required = [
      "--background", "--foreground", "--card", "--card-foreground",
      "--popover", "--popover-foreground", "--primary", "--primary-foreground",
      "--secondary", "--secondary-foreground", "--tertiary", "--tertiary-foreground",
      "--muted", "--muted-foreground", "--accent", "--accent-foreground",
      "--destructive", "--destructive-foreground", "--border",
      "--input", "--ring",
      "--sidebar", "--sidebar-foreground", "--sidebar-primary", "--sidebar-primary-foreground",
      "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-border", "--sidebar-ring",
      "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5",
    ];
    const rootIdx = src.indexOf(":root {");
    expect(rootIdx).toBeGreaterThan(0);
    const rootEnd = src.indexOf(".dark {", rootIdx);
    expect(rootEnd).toBeGreaterThan(rootIdx);
    const rootBlock = src.slice(rootIdx, rootEnd);
    for (const t of required) {
      expect(rootBlock).toMatch(new RegExp(`${t}:\\s*oklch\\(`));
    }
    expect(rootBlock).toMatch(/--radius:\s*0\.5rem/);
    expect(rootBlock).toMatch(/--border-width:\s*1px/);
  });

  test(".dark defines the full shadcn set with oklch values", () => {
    const src = readFileSync(themeCssPath, "utf-8");
    const darkIdx = src.indexOf(".dark {");
    expect(darkIdx).toBeGreaterThan(0);
    const darkEnd = src.indexOf("}", darkIdx);
    const darkBlock = src.slice(darkIdx, darkEnd);
    const required = [
      "--background", "--foreground", "--card", "--primary", "--secondary",
      "--muted", "--accent", "--destructive", "--border", "--input", "--ring",
      "--sidebar", "--sidebar-primary", "--chart-1",
    ];
    for (const t of required) {
      expect(darkBlock).toMatch(new RegExp(`${t}:\\s*oklch\\(`));
    }
  });

  test(".najm-border utility uses var(--border-width)", () => {
    const src = readFileSync(themeCssPath, "utf-8");
    expect(src).toMatch(/\.najm-border\s*\{[^}]*border-width:\s*var\(--border-width\)/);
  });
});

describe("dist/theme.css — published artifact", () => {
  test("dist/theme.css exists (build was run)", () => {
    expect(existsSync(distThemeCssPath)).toBe(true);
  });

  test("dist/theme.css has no --najm- color/radius variables", () => {
    const dist = readFileSync(distThemeCssPath, "utf-8");
    const matches = dist.match(/--najm-[\w-]+/g) ?? [];
    expect(matches).toEqual([]);
  });

  test("dist/theme.css first real @import statement is tw-animate-css", () => {
    const dist = readFileSync(distThemeCssPath, "utf-8").replace(/^\uFEFF/, "").trimStart();
    const lines = dist.split(/\n/);
    const firstImportLine = lines.find((l) => l.trimStart().startsWith("@import "));
    expect(firstImportLine).toBeTruthy();
    expect(firstImportLine!.trim()).toBe('@import "tw-animate-css";');
  });

  test("dist/theme.css :root has --background: oklch(...)", () => {
    const dist = readFileSync(distThemeCssPath, "utf-8");
    expect(dist).toMatch(/:root\s*\{[^}]*--background:\s*oklch\(/);
  });

  test("dist/theme.css has @theme inline mapping --color-background: var(--background)", () => {
    const dist = readFileSync(distThemeCssPath, "utf-8");
    expect(dist).toMatch(/@theme\s+inline\s*\{[^}]*--color-background:\s*var\(--background\)/);
  });
});

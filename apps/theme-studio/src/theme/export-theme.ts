import { stringifyNajmDesignConfig, type NajmDesignConfig } from "najm-kit";

export type ExportFormat = "json" | "typescript" | "css" | "usage";

/** Studio page-layout values (px), exported as NajmDesignConfig.layout. */
export interface ExportLayout {
  gutter: number;
  gap: number;
}

function layoutConfig(layout: ExportLayout): NonNullable<NajmDesignConfig["layout"]> {
  return { pageGutter: `${layout.gutter}px`, sectionGap: `${layout.gap}px` };
}

function withLayout(config: NajmDesignConfig, layout: ExportLayout): NajmDesignConfig {
  return { ...config, layout: layoutConfig(layout) };
}

export function toJson(config: NajmDesignConfig, layout: ExportLayout): string {
  return JSON.stringify(withLayout(config, layout), null, 2);
}

export function toTypeScript(config: NajmDesignConfig, layout: ExportLayout): string {
  const design = withLayout(config, layout);
  return [
    `import type { NajmDesignConfig } from "najm-kit";`,
    ``,
    `export const design: NajmDesignConfig = ${stringifyNajmDesignConfig(design)};`,
    ``,
  ].join("\n");
}

export function toCssVars(config: NajmDesignConfig, layout: ExportLayout): string {
  const tokens = config.theme.tokens ?? {};
  const lines = Object.entries(tokens).map(([k, v]) => `  --${k}: ${v};`);
  if (config.theme.radius) lines.push(`  --radius: ${config.theme.radius};`);
  if (config.theme.spacing) lines.push(`  --spacing: ${config.theme.spacing};`);
  const t = config.typography;
  if (t?.fontSans) lines.push(`  --font-sans: ${t.fontSans};`);
  if (t?.fontMono) lines.push(`  --font-mono: ${t.fontMono};`);
  lines.push(`  --page-gutter: ${layout.gutter}px;`);
  lines.push(`  --section-gap: ${layout.gap}px;`);
  const selector = config.theme.mode === "dark" ? ".dark" : ":root";
  return `${selector} {\n${lines.join("\n")}\n}`;
}

export function toUsageSnippet(): string {
  return [
    `import "tailwindcss";`,
    `import "najm-kit/theme.css";`,
    `import { NajmDesignProvider, NPageLayout, parseNajmDesignConfig } from "najm-kit";`,
    `import designJson from "./najm-theme.json";`,
    ``,
    `const design = parseNajmDesignConfig(designJson);`,
    ``,
    `export function Root() {`,
    `  return (`,
    `    <NajmDesignProvider config={design}>`,
    `      <NPageLayout>`,
    `        <App />`,
    `      </NPageLayout>`,
    `    </NajmDesignProvider>`,
    `  );`,
    `}`,
  ].join("\n");
}

export function exportAs(
  config: NajmDesignConfig,
  format: ExportFormat,
  layout: ExportLayout,
): string {
  switch (format) {
    case "json":
      return toJson(config, layout);
    case "typescript":
      return toTypeScript(config, layout);
    case "css":
      return toCssVars(config, layout);
    case "usage":
      return toUsageSnippet();
  }
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

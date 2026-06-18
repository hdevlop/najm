import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Button, NativeSelect, SegmentedControl } from "najm-kit";
import { useStudio, type SettingsTab } from "../app/studio-store";
import { TOKEN_CATEGORIES, CHART_TOKENS } from "../theme/token-meta";
import { PRESETS } from "../theme/presets";
import { ColorTokenControl } from "./ColorTokenControl";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "layout", label: "Layout" },
  { id: "charts", label: "Charts" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 py-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function SettingsSidebar() {
  const { activeSettingsTab, setTab } = useStudio();

  return (
    <div className="flex flex-col">
      <nav className="flex flex-wrap gap-1 border-b border-border p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              activeSettingsTab === t.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="p-3">
        {activeSettingsTab === "colors" && <ColorsTab />}
        {activeSettingsTab === "typography" && <TypographyTab />}
        {activeSettingsTab === "layout" && <LayoutTab />}
        {activeSettingsTab === "charts" && <ChartsTab />}
      </div>
    </div>
  );
}

function ColorsTab() {
  const { config, selectedPresetId, loadPreset, setAccent, activeTokenCategory, setTokenCategory } = useStudio();
  const category = TOKEN_CATEGORIES.find((c) => c.id === activeTokenCategory) ?? TOKEN_CATEGORIES[0];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Preset">
          <NativeSelect
            value={selectedPresetId ?? ""}
            placeholder="Custom"
            options={PRESETS.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(e) => loadPreset(e.target.value)}
          />
        </Field>
        <Field label="Accent">
          <NativeSelect
            value={config.theme.accent ?? "neutral"}
            options={["neutral", "emerald", "green", "slate", "blue", "violet"].map((a) => ({ value: a, label: a }))}
            onChange={(e) => setAccent(e.target.value as never)}
          />
        </Field>
      </div>

      <div className="mt-1 flex flex-wrap gap-1">
        {TOKEN_CATEGORIES.filter((c) => c.id !== "charts").map((c) => (
          <button
            key={c.id}
            onClick={() => setTokenCategory(c.id)}
            className={`cursor-pointer rounded-md px-1.5 py-0.5 text-xs transition-colors ${
              activeTokenCategory === c.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-border">
        {category.tokens.map((key) => (
          <ColorTokenControl key={key} tokenKey={key} />
        ))}
      </div>

      {category.advancedTokens && category.advancedTokens.length > 0 && (
        <details className="group mt-1 border-t border-border pt-1">
          <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <span>Advanced colors</span>
            <span className="text-[10px] uppercase tracking-normal group-open:hidden">Show</span>
            <span className="hidden text-[10px] uppercase tracking-normal group-open:inline">Hide</span>
          </summary>
          <div className="divide-y divide-border">
            {category.advancedTokens.map((key) => (
              <ColorTokenControl key={key} tokenKey={key} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function TypographyTab() {
  const { config, setTypography } = useStudio();
  const t = config.typography ?? {};
  const fonts = [
    "Geist, ui-sans-serif, system-ui, sans-serif",
    "Inter, ui-sans-serif, system-ui, sans-serif",
    "ui-sans-serif, system-ui, sans-serif",
  ];
  return (
    <div className="flex flex-col gap-1">
      <Field label="Font family">
        <NativeSelect
          value={t.fontSans ?? fonts[0]}
          options={fonts.map((f) => ({ value: f, label: f.split(",")[0] }))}
          onChange={(e) => setTypography({ fontSans: e.target.value })}
        />
      </Field>
      <Field label="Mono font">
        <NativeSelect
          value={t.fontMono ?? "JetBrains Mono, ui-monospace, monospace"}
          options={[
            { value: "JetBrains Mono, ui-monospace, monospace", label: "JetBrains Mono" },
            { value: "ui-monospace, monospace", label: "System Mono" },
          ]}
          onChange={(e) => setTypography({ fontMono: e.target.value })}
        />
      </Field>
      <Field label="Base size">
        <NativeSelect
          value={t.baseSize ?? "14px"}
          options={["13px", "14px", "15px", "16px"].map((s) => ({ value: s, label: s }))}
          onChange={(e) => setTypography({ baseSize: e.target.value })}
        />
      </Field>
      <Field label="Scale">
        <SegmentedControl
          value={t.scale ?? "default"}
          onChange={(v) => setTypography({ scale: v as never })}
          options={[
            { value: "compact", label: "Compact" },
            { value: "default", label: "Default" },
            { value: "comfortable", label: "Comfy" },
          ]}
        />
      </Field>
      <Field label="Line height">
        <NativeSelect
          value={t.lineHeight ?? "1.5"}
          options={["1.25", "1.4", "1.5", "1.6"].map((s) => ({ value: s, label: s }))}
          onChange={(e) => setTypography({ lineHeight: e.target.value })}
        />
      </Field>
      <div
        className="mt-3 rounded-md border border-border p-3"
        style={{ fontFamily: t.fontSans, fontSize: t.baseSize, lineHeight: t.lineHeight }}
      >
        <div className="text-lg font-semibold">Heading preview</div>
        <p className="text-sm text-muted-foreground">The quick brown fox jumps over the lazy dog.</p>
        <code className="text-xs" style={{ fontFamily: t.fontMono }}>const x = 42;</code>
      </div>
    </div>
  );
}

const DEFAULT_SPACING = 0.25;
const SPACING_PRESETS: { value: string; label: string }[] = [
  { value: "0.2rem", label: "Compact" },
  { value: "0.25rem", label: "Default" },
  { value: "0.3rem", label: "Comfy" },
];

function LayoutTab() {
  const {
    config,
    setThemeField,
    setBorderWidth,
    setSpacing,
    previewLayout,
    setPreviewGutter,
    setPreviewGap,
    resetPreviewLayout,
  } = useStudio();
  const radius = parseFloat(config.theme.radius ?? "0.625") || 0.625;
  const spacingValue = config.theme.spacing ?? "0.25rem";
  const spacing = parseFloat(spacingValue) || DEFAULT_SPACING;
  return (
    <div className="flex flex-col gap-2">
      <Field label={`Global radius (${config.theme.radius ?? "0.625rem"})`}>
        <input
          type="range"
          min={0}
          max={2}
          step={0.025}
          value={radius}
          onChange={(e) => setThemeField("radius", `${e.target.value}rem`)}
          className="w-full cursor-pointer"
        />
      </Field>
      <Field label="Border width">
        <NativeSelect
          value={config.theme.appearance?.borderWidth ?? "1px"}
          options={["0", "1px", "2px", "3px"].map((s) => ({ value: s, label: s === "0" ? "None" : s }))}
          onChange={(e) => setBorderWidth(e.target.value)}
        />
      </Field>
      <div className="border-t border-border pt-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Spacing density ({spacingValue})</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Reset spacing density"
            title="Reset spacing density"
            className="h-6 w-6"
            onClick={() => setSpacing("0.25rem")}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
        <p className="mb-1.5 text-[11px] leading-snug text-muted-foreground">
          Scales every component's padding, gaps, and sizing — exactly how it renders in a real app.
        </p>
        <SegmentedControl
          value={SPACING_PRESETS.some((p) => p.value === spacingValue) ? spacingValue : ""}
          onChange={(v) => setSpacing(v)}
          options={SPACING_PRESETS}
        />
        <input
          type="range"
          min={0.15}
          max={0.4}
          step={0.01}
          value={spacing}
          onChange={(e) => setSpacing(`${e.target.value}rem`)}
          className="mt-2 w-full cursor-pointer"
        />
      </div>
      <div className="border-t border-border pt-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Preview layout</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Reset preview layout"
            title="Reset preview layout"
            className="h-6 w-6"
            onClick={resetPreviewLayout}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
        <p className="mb-1.5 text-[11px] leading-snug text-muted-foreground">
          Gutter controls left/right only; spacing controls the vertical gaps between sections (and top/bottom). Applied evenly across every preview tab. Studio-only; not exported.
        </p>
        <Field label={`Left/right gutter (${previewLayout.gutter}px)`}>
          <input
            type="range"
            min={0}
            max={64}
            step={1}
            value={previewLayout.gutter}
            onChange={(e) => setPreviewGutter(e.target.valueAsNumber)}
            className="w-full cursor-pointer"
          />
        </Field>
        <Field label={`Space between elements (${previewLayout.gap}px)`}>
          <input
            type="range"
            min={0}
            max={64}
            step={1}
            value={previewLayout.gap}
            onChange={(e) => setPreviewGap(e.target.valueAsNumber)}
            className="w-full cursor-pointer"
          />
        </Field>
      </div>
    </div>
  );
}

function ChartsTab() {
  return (
    <div className="flex flex-col">
      <p className="pb-1 text-xs text-muted-foreground">Chart palette tokens consumed by the charts preview.</p>
      <div className="divide-y divide-border">
        {CHART_TOKENS.map((key) => (
          <ColorTokenControl key={key} tokenKey={key} />
        ))}
      </div>
    </div>
  );
}

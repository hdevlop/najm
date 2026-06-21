import { NativeSelect, SegmentedControl } from "najm-kit";
import { useStudio } from "../../app/studio-store";
import { Field } from "./Field";

interface FontOption {
  value: string;
  label: string;
}

const SANS_FONT_OPTIONS: FontOption[] = [
  { label: "Geist", value: "Geist, ui-sans-serif, system-ui, sans-serif" },
  { label: "Inter", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "Manrope", value: "Manrope, ui-sans-serif, system-ui, sans-serif" },
  { label: "Plus Jakarta Sans", value: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif" },
  { label: "DM Sans", value: "DM Sans, ui-sans-serif, system-ui, sans-serif" },
  { label: "Outfit", value: "Outfit, ui-sans-serif, system-ui, sans-serif" },
  { label: "Sora", value: "Sora, ui-sans-serif, system-ui, sans-serif" },
  { label: "Work Sans", value: "Work Sans, ui-sans-serif, system-ui, sans-serif" },
  { label: "IBM Plex Sans", value: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif" },
  { label: "Source Sans 3", value: "Source Sans 3, ui-sans-serif, system-ui, sans-serif" },
  { label: "Libre Baskerville", value: "Libre Baskerville, serif" },
  { label: "Lora", value: "Lora, serif" },
  { label: "System Sans", value: "ui-sans-serif, system-ui, sans-serif" },
];

const HEADING_FONT_OPTIONS: FontOption[] = [
  { label: "Geist", value: "Geist, ui-sans-serif, system-ui, sans-serif" },
  { label: "Sora", value: "Sora, ui-sans-serif, system-ui, sans-serif" },
  { label: "Outfit", value: "Outfit, ui-sans-serif, system-ui, sans-serif" },
  { label: "Space Grotesk", value: "Space Grotesk, ui-sans-serif, system-ui, sans-serif" },
  { label: "Plus Jakarta Sans", value: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif" },
  { label: "Playfair Display", value: "Playfair Display, Georgia, serif" },
  { label: "Libre Baskerville", value: "Libre Baskerville, serif" },
  { label: "Lora", value: "Lora, serif" },
  { label: "Merriweather", value: "Merriweather, Georgia, serif" },
  { label: "Cormorant Garamond", value: "Cormorant Garamond, Georgia, serif" },
  { label: "Body Font", value: "inherit" },
];

const MONO_FONT_OPTIONS: FontOption[] = [
  { label: "JetBrains Mono", value: "JetBrains Mono, ui-monospace, monospace" },
  { label: "IBM Plex Mono", value: "IBM Plex Mono, monospace" },
  { label: "Fira Code", value: "Fira Code, ui-monospace, monospace" },
  { label: "Roboto Mono", value: "Roboto Mono, ui-monospace, monospace" },
  { label: "Source Code Pro", value: "Source Code Pro, ui-monospace, monospace" },
  { label: "Space Mono", value: "Space Mono, ui-monospace, monospace" },
  { label: "System Mono", value: "ui-monospace, monospace" },
];

function fontLabel(value: string): string {
  return value.split(",")[0]?.replaceAll("'", "").trim() || "Custom font";
}

function fontOptionsWithCurrent(options: FontOption[], value: string): FontOption[] {
  if (!value || options.some((option) => option.value === value)) return options;
  return [{ label: `${fontLabel(value)} (current)`, value }, ...options];
}

export function TypographyTab() {
  const { config, setTypography } = useStudio();
  const t = config.typography ?? {};
  const bodyFont = t.fontSans ?? SANS_FONT_OPTIONS[0].value;
  const headingFont = t.fontHeading ?? bodyFont;
  const monoFont = t.fontMono ?? MONO_FONT_OPTIONS[0].value;
  const headingFollowsBody = !t.fontHeading || t.fontHeading === bodyFont || t.fontHeading === "inherit";

  function updateBodyFont(value: string) {
    setTypography({
      fontSans: value,
      ...(headingFollowsBody ? { fontHeading: value } : {}),
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Field label="Body font">
        <NativeSelect
          value={bodyFont}
          options={fontOptionsWithCurrent(SANS_FONT_OPTIONS, bodyFont)}
          onChange={(e) => updateBodyFont(e.target.value)}
        />
      </Field>
      <Field label="Heading font">
        <NativeSelect
          value={headingFont}
          options={fontOptionsWithCurrent(HEADING_FONT_OPTIONS, headingFont)}
          onChange={(e) => setTypography({ fontHeading: e.target.value })}
        />
      </Field>
      <Field label="Mono font">
        <NativeSelect
          value={monoFont}
          options={fontOptionsWithCurrent(MONO_FONT_OPTIONS, monoFont)}
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
        style={{ fontFamily: bodyFont, fontSize: t.baseSize, lineHeight: t.lineHeight }}
      >
        <div className="text-lg font-semibold" style={{ fontFamily: headingFont }}>
          Heading preview
        </div>
        <p className="text-sm text-muted-foreground">The quick brown fox jumps over the lazy dog.</p>
        <code className="text-xs" style={{ fontFamily: monoFont }}>const x = 42;</code>
      </div>
    </div>
  );
}

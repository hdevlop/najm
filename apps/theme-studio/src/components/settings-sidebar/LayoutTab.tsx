import { RotateCcw } from "lucide-react";
import { NButton, NativeSelect } from "najm-kit";
import { useStudio } from "../../app/studio-store";
import { Field } from "./Field";

const PX_STEPS = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
const RADIUS_STEPS = ["0", "0.125", "0.25", "0.375", "0.5", "0.625", "0.75", "1", "1.25", "1.5", "2"];

export function LayoutTab() {
  const {
    config,
    setThemeField,
    setBorderWidth,
    previewLayout,
    setPreviewGutter,
    setPreviewGap,
    resetPreviewLayout,
  } = useStudio();
  const radius = String(parseFloat(config.theme.radius ?? "0.625") || 0.625);

  return (
    <div className="flex flex-col gap-2">
      <Field label="Global radius">
        <NativeSelect
          value={radius}
          options={RADIUS_STEPS.map((s) => ({ value: s, label: `${s}rem` }))}
          onChange={(e) => setThemeField("radius", `${e.target.value}rem`)}
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
          <span className="text-xs font-medium text-muted-foreground">Preview layout</span>
          <NButton
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Reset preview layout"
            title="Reset preview layout"
            className="h-6 w-6"
            onClick={resetPreviewLayout}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </NButton>
        </div>
        <p className="mb-1.5 text-[11px] leading-snug text-muted-foreground">
          Gutter controls left/right only; spacing controls the vertical gaps between sections (and top/bottom). Applied evenly across every preview tab. Studio-only; not exported.
        </p>
        <Field label="Left/right gutter">
          <NativeSelect
            value={String(previewLayout.gutter)}
            options={PX_STEPS.map((n) => ({ value: String(n), label: `${n}px` }))}
            onChange={(e) => setPreviewGutter(Number(e.target.value))}
          />
        </Field>
        <Field label="Space between elements">
          <NativeSelect
            value={String(previewLayout.gap)}
            options={PX_STEPS.map((n) => ({ value: String(n), label: `${n}px` }))}
            onChange={(e) => setPreviewGap(Number(e.target.value))}
          />
        </Field>
      </div>
    </div>
  );
}

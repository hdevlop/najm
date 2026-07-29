import {
  NSheet,
  NativeSelect,
  NButton,
  Switch,
  Label,
} from "najm-kit";
import { SlidersHorizontal } from "lucide-react";
import { useStudio } from "../app/studio-store";
import {
  COMPONENT_META,
  RADIUS_OPTIONS,
  DENSITY_OPTIONS,
} from "../theme/component-meta";

const DEFAULT_SIDEBAR_CONTENT_TOP_PADDING = 8;

const NAV_TOP_PADDING_OPTIONS = [4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64] as const;

function pxNumber(value: string | undefined, fallback = DEFAULT_SIDEBAR_CONTENT_TOP_PADDING): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex-col items-start gap-1 text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/25 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-xs font-medium text-foreground">{label}</div>
        <div className="mt-0.5 text-xs leading-4 text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} size="sm" />
    </div>
  );
}

export function ComponentStyleFlyout() {
  const {
    flyoutOpen,
    closeFlyout,
    selectedComponent,
    config,
    setComponentConfig,
    setComponentVariantAlias,
    resetComponent,
  } = useStudio();

  if (!selectedComponent) return null;
  const meta = COMPONENT_META[selectedComponent];
  const cfg = config.components?.[selectedComponent] ?? {};
  const controls = meta.controls;
  const sidebarContentTopPadding = pxNumber(cfg.slots?.content?.paddingTop);

  const setSidebarContentTopPadding = (value: number | undefined) => {
    const slots = { ...(cfg.slots ?? {}) };
    const content = { ...(slots.content ?? {}) };
    if (value === undefined) {
      delete content.paddingTop;
    } else {
      content.paddingTop = `${Math.max(0, Math.min(64, Math.round(value)))}px`;
    }

    if (Object.keys(content).length > 0) {
      slots.content = content;
    } else {
      delete slots.content;
    }

    setComponentConfig(selectedComponent, {
      slots: Object.keys(slots).length > 0 ? slots : undefined,
    });
  };

  return (
    <NSheet
      icon={SlidersHorizontal}
      open={flyoutOpen}
      onOpenChange={(v) => !v && closeFlyout()}
      title={`Style ${meta.label}`}
      description={`Applies to all ${meta.label} components.`}
      width={320}
      bodyClassName="px-4 py-4"
      footer={
        <div className="flex justify-end gap-2">
          <NButton
            variant="outline"
            onClick={() => resetComponent(selectedComponent)}
            className="text-foreground !border-white/25 hover:text-foreground hover:!border-white/40 dark:!border-white/20 dark:hover:!border-white/35"
          >
            Reset {meta.label}
          </NButton>
          <NButton onClick={closeFlyout}>Done</NButton>
        </div>
      }
    >
        <div className="flex flex-col gap-3">
          {controls.card && (
            <Row label="Display">
              <NativeSelect
                value={cfg.card ? "card" : "bar"}
                options={[
                  { value: "bar", label: "Bar" },
                  { value: "card", label: "Card" },
                ]}
                onChange={(e) =>
                  setComponentConfig(selectedComponent, {
                    card: e.target.value === "card" ? true : undefined,
                  })
                }
              />
            </Row>
          )}
          {controls.radius && (
            <Row label="Radius">
              <NativeSelect
                value={cfg.radius ?? "inherit"}
                options={RADIUS_OPTIONS.map((r) => ({ value: r, label: r }))}
                onChange={(e) =>
                  setComponentConfig(selectedComponent, {
                    radius: e.target.value === "inherit" ? undefined : e.target.value,
                  })
                }
              />
            </Row>
          )}
          {controls.density && (
            <Row label="Density">
              <NativeSelect
                value={cfg.density ?? "default"}
                options={DENSITY_OPTIONS.map((d) => ({ value: d, label: d }))}
                onChange={(e) => setComponentConfig(selectedComponent, { density: e.target.value as never })}
              />
            </Row>
          )}
          {controls.borderWidth && (
            <Row label="Border width">
              <NativeSelect
                value={cfg.borderWidth ?? ""}
                placeholder="inherit"
                options={["0", "1px", "2px", "3px"].map((b) => ({ value: b, label: b === "0" ? "none" : b }))}
                onChange={(e) => setComponentConfig(selectedComponent, { borderWidth: e.target.value })}
              />
            </Row>
          )}
          {controls.showSectionLabels && (
            <SwitchRow
              label="Section titles"
              description="Show group titles above sidebar items."
              checked={cfg.showSectionLabels ?? true}
              onCheckedChange={(checked) =>
                setComponentConfig(selectedComponent, { showSectionLabels: checked })
              }
            />
          )}
          {controls.showSectionSeparators && (
            <SwitchRow
              label="Separator lines"
              description="Draw lines between sidebar item sections."
              checked={cfg.showSectionSeparators ?? true}
              onCheckedChange={(checked) =>
                setComponentConfig(selectedComponent, { showSectionSeparators: checked })
              }
            />
          )}
          {controls.contentTopPadding && (
            <Row label="Nav top padding">
              <NativeSelect
                value={String(sidebarContentTopPadding)}
                placeholder="inherit"
                options={NAV_TOP_PADDING_OPTIONS.map((p) => ({ value: String(p), label: `${p}px` }))}
                onChange={(e) => setSidebarContentTopPadding(Number(e.target.value))}
              />
            </Row>
          )}
          {controls.defaultVariant && (
            <Row label="Default variant">
              <NativeSelect
                value={cfg.defaultVariant ?? ""}
                placeholder="inherit"
                options={controls.defaultVariant.map((v) => ({ value: v, label: v }))}
                onChange={(e) => setComponentConfig(selectedComponent, { defaultVariant: e.target.value })}
              />
            </Row>
          )}
          {controls.defaultSize && (
            <Row label="Default size">
              <NativeSelect
                value={cfg.defaultSize ?? ""}
                placeholder="inherit"
                options={controls.defaultSize.map((s) => ({ value: s, label: s }))}
                onChange={(e) => setComponentConfig(selectedComponent, { defaultSize: e.target.value })}
              />
            </Row>
          )}
          {controls.variantAlias && (
            <Row label={`Alias "${controls.variantAlias[0]}" to`}>
              <NativeSelect
                value={cfg.variants?.[controls.variantAlias[0]]?.use ?? ""}
                placeholder="none"
                options={controls.variantAlias
                  .filter((v) => v !== controls.variantAlias![0])
                  .map((v) => ({ value: v, label: v }))}
                onChange={(e) =>
                  setComponentVariantAlias(
                    selectedComponent,
                    controls.variantAlias![0],
                    e.target.value || undefined,
                  )
                }
              />
            </Row>
          )}
        </div>
    </NSheet>
  );
}

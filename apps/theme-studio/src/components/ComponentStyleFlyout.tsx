import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  NativeSelect,
  Button,
} from "najm-kit";
import { useStudio } from "../app/studio-store";
import {
  COMPONENT_META,
  RADIUS_OPTIONS,
  DENSITY_OPTIONS,
} from "../theme/component-meta";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
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

  return (
    <Sheet open={flyoutOpen} onOpenChange={(v) => !v && closeFlyout()}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Style {meta.label}</SheetTitle>
          <SheetDescription>Applies to all {meta.label} components.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4">
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

        <SheetFooter>
          <Button variant="outline" onClick={() => resetComponent(selectedComponent)}>
            Reset {meta.label}
          </Button>
          <Button onClick={closeFlyout}>Done</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

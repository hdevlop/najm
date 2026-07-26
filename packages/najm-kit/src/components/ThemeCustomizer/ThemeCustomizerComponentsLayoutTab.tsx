import * as React from "react";
import { cn } from "../../lib/cn";
import { ColorPickerInput } from "../inputs/ColorPickerInput";
import { SelectInput } from "../inputs/SelectInput";
import { Switch } from "../ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { ChevronDown } from "lucide-react";
import { CustomizerField } from "./CustomizerField";
import {
  COMPONENT_BORDER_WIDTH_VALUES,
  BORDER_WIDTH_VALUES,
  LAYOUT_SIZE_VALUES,
  RADIUS_VALUES,
  isValidColorString,
  setComponentField,
  setLayoutField,
  setThemeField,
} from "./theme-customizer-config";
import type { NajmDesignConfig, NajmComponentName } from "../../theme/design-types";

export interface ThemeCustomizerComponentsLayoutTabLabels {
  resetField: React.ReactNode;
  defaultOption: React.ReactNode;
  layoutSubsection: React.ReactNode;
  pageHeaderSubsection: React.ReactNode;
  sidebarSubsection: React.ReactNode;
  tableSubsection: React.ReactNode;
  inputSubsection: React.ReactNode;
  pageGutter: React.ReactNode;
  sectionGap: React.ReactNode;
  pageHeaderCard: React.ReactNode;
  sidebarSectionLabels: React.ReactNode;
  sidebarSectionSeparators: React.ReactNode;
  tableHeaderColor: React.ReactNode;
  tableHeaderTextColor: React.ReactNode;
  tableBorderColor: React.ReactNode;
  inputBorderWidth: React.ReactNode;
  globalBorderWidth: React.ReactNode;
  globalRadius: React.ReactNode;
}

export interface ThemeCustomizerComponentsLayoutTabProps {
  value: NajmDesignConfig;
  factoryValue: NajmDesignConfig;
  onChange: (value: NajmDesignConfig) => void;
  labels: ThemeCustomizerComponentsLayoutTabLabels;
  disabled?: boolean;
  showTableColors?: boolean;
}

export function ThemeCustomizerComponentsLayoutTab({
  value,
  factoryValue,
  onChange,
  labels,
  disabled,
  showTableColors = true,
}: ThemeCustomizerComponentsLayoutTabProps) {
  const layout = value.layout ?? {};
  const components = value.components ?? {};
  const factoryComponents = factoryValue.components ?? {};

  const handleColor = (
    component: NajmComponentName,
    key: "headerColor" | "headerTextColor" | "borderColor",
    raw: string,
  ) => {
    if (!isValidColorString(raw)) return;
    onChange(setComponentField(value, component, key, raw));
  };

  const handleResetComponentField = (
    component: NajmComponentName,
    key: "card" | "showSectionLabels" | "showSectionSeparators" | "headerColor" | "headerTextColor" | "borderColor" | "borderWidth",
  ) => {
    const factory = factoryComponents[component];
    if (!factory || factory[key] === undefined) {
      const next = { ...value };
      const comps = { ...(next.components ?? {}) };
      const current = { ...(comps[component] ?? {}) };
      delete current[key];
      if (Object.keys(current).length === 0) delete comps[component];
      else comps[component] = current;
      if (Object.keys(comps).length === 0) delete next.components;
      else next.components = comps;
      onChange(next);
      return;
    }
    onChange(
      setComponentField(value, component, key, factory[key] as never),
    );
  };

  const labelText = (node: React.ReactNode): string => {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(labelText).join("");
    if (node && typeof node === "object" && "props" in node) {
      // @ts-expect-error - React element children
      return labelText(node.props.children);
    }
    return "";
  };

  const toOption = (node: React.ReactNode, value: string) => ({
    value,
    label: labelText(node) || value,
  });

  return (
    <div className="flex flex-col gap-4">
      <Section title={labels.layoutSubsection} disabled={disabled}>
        <div className="grid grid-cols-2 gap-3">
          <CustomizerField
            label={labels.pageGutter}
            disabled={disabled}
          >
            <SelectInput
              value={layout.pageGutter ?? ""}
              onChange={(next) =>
                onChange(setLayoutField(value, "pageGutter", next || undefined))
              }
              items={[
                toOption(labels.defaultOption, ""),
                ...LAYOUT_SIZE_VALUES.map((value) => ({ value, label: value })),
              ]}
              disabled={disabled}
              ariaLabel={
                typeof labels.pageGutter === "string" ? labels.pageGutter : "Page gutter"
              }
            />
          </CustomizerField>

          <CustomizerField
            label={labels.sectionGap}
            disabled={disabled}
          >
            <SelectInput
              value={layout.sectionGap ?? ""}
              onChange={(next) =>
                onChange(setLayoutField(value, "sectionGap", next || undefined))
              }
              items={[
                toOption(labels.defaultOption, ""),
                ...LAYOUT_SIZE_VALUES.map((value) => ({ value, label: value })),
              ]}
              disabled={disabled}
              ariaLabel={
                typeof labels.sectionGap === "string" ? labels.sectionGap : "Section gap"
              }
            />
          </CustomizerField>

          <CustomizerField label={labels.globalBorderWidth} disabled={disabled}>
            <SelectInput
              value={value.theme.appearance?.borderWidth ?? "1px"}
              onChange={(next) => onChange(setThemeField(value, "appearance", {
                ...(value.theme.appearance ?? {}),
                borderWidth: next,
              }))}
              items={BORDER_WIDTH_VALUES.map((borderWidth) => ({ value: borderWidth, label: borderWidth }))}
              disabled={disabled}
              ariaLabel={typeof labels.globalBorderWidth === "string" ? labels.globalBorderWidth : "Border width"}
            />
          </CustomizerField>

          <CustomizerField label={labels.inputBorderWidth} disabled={disabled}>
            <SelectInput
              value={components.input?.borderWidth ?? ""}
              onChange={(next) =>
                onChange(setComponentField(value, "input", "borderWidth", next || undefined))
              }
              items={[
                toOption(labels.defaultOption, ""),
                ...COMPONENT_BORDER_WIDTH_VALUES.map((value) => ({ value, label: value })),
              ]}
              disabled={disabled}
              ariaLabel={typeof labels.inputBorderWidth === "string" ? labels.inputBorderWidth : "Input border width"}
            />
          </CustomizerField>

          <CustomizerField className="col-span-2" label={labels.globalRadius} disabled={disabled}>
            <SelectInput
              value={value.theme.radius ?? "8px"}
              onChange={(next) => onChange(setThemeField(value, "radius", next))}
              items={RADIUS_VALUES.map((radius) => ({ value: radius, label: radius }))}
              disabled={disabled}
              ariaLabel={typeof labels.globalRadius === "string" ? labels.globalRadius : "Radius"}
            />
          </CustomizerField>
        </div>
      </Section>

      <Section title={labels.pageHeaderSubsection} disabled={disabled}>
        <SwitchField
          label={labels.pageHeaderCard}
          checked={Boolean(components.pageHeader?.card)}
          onChange={(next) =>
            onChange(setComponentField(value, "pageHeader", "card", next))
          }
          onReset={
            components.pageHeader?.card !== factoryComponents.pageHeader?.card
              ? () => handleResetComponentField("pageHeader", "card")
              : undefined
          }
          resetLabel={labels.resetField}
          resetAriaLabel={`${labels.resetField} ${labelText(labels.pageHeaderCard)}`.trim()}
          disabled={disabled}
        />
      </Section>

      <Section title={labels.sidebarSubsection} disabled={disabled}>
        <SwitchField
          label={labels.sidebarSectionLabels}
          checked={Boolean(components.sidebar?.showSectionLabels)}
          onChange={(next) =>
            onChange(setComponentField(value, "sidebar", "showSectionLabels", next))
          }
          onReset={
            components.sidebar?.showSectionLabels !==
            factoryComponents.sidebar?.showSectionLabels
              ? () => handleResetComponentField("sidebar", "showSectionLabels")
              : undefined
          }
          resetLabel={labels.resetField}
          resetAriaLabel={`${labels.resetField} ${labelText(labels.sidebarSectionLabels)}`.trim()}
          disabled={disabled}
        />
        <SwitchField
          label={labels.sidebarSectionSeparators}
          checked={Boolean(components.sidebar?.showSectionSeparators)}
          onChange={(next) =>
            onChange(setComponentField(value, "sidebar", "showSectionSeparators", next))
          }
          onReset={
            components.sidebar?.showSectionSeparators !==
            factoryComponents.sidebar?.showSectionSeparators
              ? () => handleResetComponentField("sidebar", "showSectionSeparators")
              : undefined
          }
          resetLabel={labels.resetField}
          resetAriaLabel={`${labels.resetField} ${labelText(labels.sidebarSectionSeparators)}`.trim()}
          disabled={disabled}
        />
      </Section>

      {showTableColors && <CollapsibleSection title={labels.tableSubsection} disabled={disabled}>
        <div className="grid grid-cols-1 gap-2 @min-[720px]:grid-cols-2">
          <CustomizerField
            label={labels.tableHeaderColor}
            onReset={
              components.table?.headerColor !== factoryComponents.table?.headerColor
                ? () => handleResetComponentField("table", "headerColor")
                : undefined
            }
            resetLabel={labels.resetField}
            disabled={disabled}
          >
            <div
              role="group"
              aria-label={labelText(labels.tableHeaderColor) || "Table header color"}
              data-disabled={disabled ? "" : undefined}
              className={cn(disabled && "pointer-events-none opacity-60")}
            >
              <ColorPickerInput
                mode="popover"
                output="preserve"
                hideSwatches
                value={components.table?.headerColor || "oklch(0.5 0 0)"}
                onChange={(next) => handleColor("table", "headerColor", next)}
                disabled={disabled}
                className="w-full"
              />
            </div>
          </CustomizerField>
          <CustomizerField
            label={labels.tableHeaderTextColor}
            onReset={
              components.table?.headerTextColor !==
              factoryComponents.table?.headerTextColor
                ? () => handleResetComponentField("table", "headerTextColor")
                : undefined
            }
            resetLabel={labels.resetField}
            disabled={disabled}
          >
            <div
              role="group"
              aria-label={labelText(labels.tableHeaderTextColor) || "Table header text color"}
              data-disabled={disabled ? "" : undefined}
              className={cn(disabled && "pointer-events-none opacity-60")}
            >
              <ColorPickerInput
                mode="popover"
                output="preserve"
                hideSwatches
                value={components.table?.headerTextColor || "oklch(1 0 0)"}
                onChange={(next) => handleColor("table", "headerTextColor", next)}
                disabled={disabled}
                className="w-full"
              />
            </div>
          </CustomizerField>
          <CustomizerField
            label={labels.tableBorderColor}
            onReset={
              components.table?.borderColor !== factoryComponents.table?.borderColor
                ? () => handleResetComponentField("table", "borderColor")
                : undefined
            }
            resetLabel={labels.resetField}
            disabled={disabled}
          >
            <div
              role="group"
              aria-label={labelText(labels.tableBorderColor) || "Table border color"}
              data-disabled={disabled ? "" : undefined}
              className={cn(disabled && "pointer-events-none opacity-60")}
            >
              <ColorPickerInput
                mode="popover"
                output="preserve"
                hideSwatches
                value={components.table?.borderColor || "oklch(0.9 0 0)"}
                onChange={(next) => handleColor("table", "borderColor", next)}
                disabled={disabled}
                className="w-full"
              />
            </div>
          </CustomizerField>
        </div>
      </CollapsibleSection>}

    </div>
  );
}

interface SectionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}

function Section({ title, children, disabled }: SectionProps) {
  return (
    <CollapsibleSection title={title} disabled={disabled}>
      {children}
    </CollapsibleSection>
  );
}

export interface ThemeCustomizerTableColorsProps {
  value: NajmDesignConfig;
  factoryValue: NajmDesignConfig;
  onChange: (value: NajmDesignConfig) => void;
  labels: Pick<
    ThemeCustomizerComponentsLayoutTabLabels,
    "resetField" | "tableHeaderColor" | "tableHeaderTextColor" | "tableBorderColor"
  >;
  disabled?: boolean;
}

export function ThemeCustomizerTableColors({
  value,
  factoryValue,
  onChange,
  labels,
  disabled,
}: ThemeCustomizerTableColorsProps) {
  const components = value.components ?? {};
  const factoryComponents = factoryValue.components ?? {};
  const labelText = (node: React.ReactNode): string =>
    typeof node === "string" || typeof node === "number" ? String(node) : "Color";
  const handleColor = (
    key: "headerColor" | "headerTextColor" | "borderColor",
    raw: string,
  ) => {
    if (isValidColorString(raw)) onChange(setComponentField(value, "table", key, raw));
  };
  const reset = (key: "headerColor" | "headerTextColor" | "borderColor") => {
    const factory = factoryComponents.table?.[key];
    onChange(setComponentField(value, "table", key, factory));
  };
  const fields = [
    ["headerColor", labels.tableHeaderColor, "oklch(0.5 0 0)"],
    ["headerTextColor", labels.tableHeaderTextColor, "oklch(1 0 0)"],
    ["borderColor", labels.tableBorderColor, "oklch(0.9 0 0)"],
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-2 @min-[720px]:grid-cols-2">
      {fields.map(([key, label, fallback]) => (
        <CustomizerField
          key={key}
          label={label}
          layout="inline-start"
          onReset={components.table?.[key] !== factoryComponents.table?.[key] ? () => reset(key) : undefined}
          resetLabel={labels.resetField}
          disabled={disabled}
        >
          <ColorPickerInput
            mode="popover"
            output="preserve"
            hideSwatches
            value={components.table?.[key] || fallback}
            onChange={(next) => handleColor(key, next)}
            disabled={disabled}
            className="h-9 w-full gap-2 px-2 py-1 text-xs [&>span:first-child]:size-6 [&>span:last-child]:text-xs"
            aria-label={labelText(label)}
          />
        </CustomizerField>
      ))}
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
  disabled,
}: SectionProps) {
  const [open, setOpen] = React.useState(true);
  const titleText =
    typeof title === "string" || typeof title === "number" ? String(title) : "Section";

  return (
    <Collapsible
      open={open}
      onOpenChange={disabled ? undefined : setOpen}
      disabled={disabled}
      className="rounded-md border border-border/60 bg-card/40"
    >
      <CollapsibleTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          aria-disabled={disabled}
          aria-label={titleText}
          className={cn(
            "flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide",
            "text-muted-foreground hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-md",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <span>{title}</span>
          <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out">
        <div className={cn("flex flex-col  px-3 ", disabled && "pointer-events-none opacity-60")}>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface SwitchFieldProps {
  label: React.ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  onReset?: () => void;
  resetLabel?: React.ReactNode;
  resetAriaLabel?: React.ReactNode;
  disabled?: boolean;
}

function SwitchField({
  label,
  checked,
  onChange,
  onReset,
  resetLabel,
  resetAriaLabel,
  disabled,
}: SwitchFieldProps) {
  return (
    <CustomizerField
      label={label}
      layout="inline-start"
      className="[&>div:first-child]:w-auto [&>div:first-child]:flex-1"
      onReset={onReset}
      resetLabel={resetLabel}
      resetAriaLabel={resetAriaLabel}
      disabled={disabled}
    >
      <div className={cn("flex h-9 items-center")}>
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
          aria-label={typeof label === "string" ? label : "Toggle"}
        />
      </div>
    </CustomizerField>
  );
}

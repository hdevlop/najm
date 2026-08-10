import * as React from "react";
import { cn } from "../../lib/cn";
import { ColorPickerInput } from "../inputs/ColorPickerInput";
import { SegmentedControl } from "../ui/segmented-control";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { focusRingClasses } from "../../theme/focus";
import { ChevronDown } from "lucide-react";
import { CustomizerField } from "./CustomizerField";
import { ThemeCustomizerTableColors } from "./ThemeCustomizerComponentsLayoutTab";
import {
  getEffectiveThemeToken,
  isValidColorString,
  resetThemeToken,
  setThemeToken,
} from "./theme-customizer-config";
import {
  DEFAULT_OPTION_LABELS,
  humanizeTokenKey,
  THEME_TOKEN_GROUPS,
} from "./theme-customizer-meta";
import type { ThemeCustomizerTokenKey } from "./theme-customizer-config";
import type { NajmDesignConfig } from "../../theme/design-types";
import type { NajmMode } from "../../theme/types";
import type {
  NThemeCustomizerLabels,
  NThemeCustomizerOptionLabels,
} from "./types";

export interface ThemeCustomizerThemeTabLabels {
  resetField: React.ReactNode;
  resetSection: React.ReactNode;
  colorSwatchFallback: React.ReactNode;
  defaultOption: React.ReactNode;
  lightMode: React.ReactNode;
  darkMode: React.ReactNode;
  surfaceGroup: React.ReactNode;
  brandGroup: React.ReactNode;
  feedbackGroup: React.ReactNode;
  borderFocusGroup: React.ReactNode;
  sidebarGroup: React.ReactNode;
  chartsGroup: React.ReactNode;
  globalBorderWidth: React.ReactNode;
  tableSubsection: React.ReactNode;
  tableHeaderColor: React.ReactNode;
  tableHeaderTextColor: React.ReactNode;
  tableBorderColor: React.ReactNode;
  previewMode: React.ReactNode;
  tokens: Partial<NThemeCustomizerLabels["tokens"]>;
  options: Partial<NThemeCustomizerOptionLabels>;
}

export interface ThemeCustomizerThemeTabProps {
  value: NajmDesignConfig;
  factoryValue: NajmDesignConfig;
  onChange: (value: NajmDesignConfig) => void;
  previewMode: NajmMode;
  onPreviewModeChange?: (mode: NajmMode) => void;
  showPreviewMode?: boolean;
  labels: ThemeCustomizerThemeTabLabels;
  disabled?: boolean;
}

export function ThemeCustomizerThemeTab({
  value,
  factoryValue,
  onChange,
  previewMode,
  onPreviewModeChange,
  showPreviewMode = false,
  labels,
  disabled,
}: ThemeCustomizerThemeTabProps) {
  return (
    <div className="flex flex-col gap-3">
      {showPreviewMode && onPreviewModeChange && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {labels.previewMode}
          </span>
          <SegmentedControl
            ariaLabel={typeof labels.previewMode === "string" ? labels.previewMode : "Preview mode"}
            value={previewMode}
            onChange={onPreviewModeChange}
            options={[
              { value: "light", label: labels.lightMode, ariaLabel: typeof labels.lightMode === "string" ? labels.lightMode : "Light" },
              { value: "dark", label: labels.darkMode, ariaLabel: typeof labels.darkMode === "string" ? labels.darkMode : "Dark" },
            ]}
            size="sm"
            disabled={disabled}
          />
        </div>
      )}

      {THEME_TOKEN_GROUPS.map((group) => (
        <TokenGroupSection
          key={group.id}
          groupId={group.id}
          label={
            group.id === "surface"
              ? labels.surfaceGroup
              : group.id === "brand"
                ? labels.brandGroup
                : group.id === "feedback"
                  ? labels.feedbackGroup
                  : group.id === "border-focus"
                    ? labels.borderFocusGroup
                    : group.id === "sidebar"
                      ? labels.sidebarGroup
                      : labels.chartsGroup
          }
          tokens={group.tokens}
          value={value}
          factoryValue={factoryValue}
          previewMode={previewMode}
          onChange={onChange}
          disabled={disabled}
          labels={labels}
        />
      ))}

      <TokenGroupSection
        groupId="table-colors"
        label={labels.tableSubsection}
        value={value}
        factoryValue={factoryValue}
        previewMode={previewMode}
        onChange={onChange}
        disabled={disabled}
        labels={labels}
      >
        <ThemeCustomizerTableColors
          value={value}
          factoryValue={factoryValue}
          onChange={onChange}
          disabled={disabled}
          labels={{
            resetField: labels.resetField,
            tableHeaderColor: labels.tableHeaderColor,
            tableHeaderTextColor: labels.tableHeaderTextColor,
            tableBorderColor: labels.tableBorderColor,
          }}
        />
      </TokenGroupSection>

    </div>
  );
}

interface TokenGroupSectionProps {
  groupId: string;
  label: React.ReactNode;
  tokens?: readonly ThemeCustomizerTokenKey[];
  children?: React.ReactNode;
  value: NajmDesignConfig;
  factoryValue: NajmDesignConfig;
  previewMode: NajmMode;
  onChange: (value: NajmDesignConfig) => void;
  disabled?: boolean;
  labels: ThemeCustomizerThemeTabLabels;
}

function TokenGroupSection({
  groupId,
  label,
  tokens,
  children,
  value,
  factoryValue,
  previewMode,
  onChange,
  disabled,
  labels,
}: TokenGroupSectionProps) {
  const [open, setOpen] = React.useState<boolean>(groupId === "surface" || groupId === "brand");
  const labelText =
    typeof label === "string" || typeof label === "number" ? String(label) : "Group";

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
          data-disabled={disabled ? "" : undefined}
          className={cn(
            "flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide",
            "text-muted-foreground hover:text-foreground",
            focusRingClasses,
            "focus-visible:rounded-md",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
          aria-label={labelText}
        >
          <span>{label}</span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out">
        <div
          className={cn(
            "grid grid-cols-1 gap-2 px-3 pb-3 @min-[720px]:grid-cols-2",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          {children ?? tokens?.map((tokenKey) => (
            <TokenField
              key={tokenKey}
              tokenKey={tokenKey}
              value={value}
              factoryValue={factoryValue}
              previewMode={previewMode}
              onChange={onChange}
              disabled={disabled}
              labels={labels}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface TokenFieldProps {
  tokenKey: ThemeCustomizerTokenKey;
  value: NajmDesignConfig;
  factoryValue: NajmDesignConfig;
  previewMode: NajmMode;
  onChange: (value: NajmDesignConfig) => void;
  disabled?: boolean;
  labels: ThemeCustomizerThemeTabLabels;
}

function TokenField({
  tokenKey,
  value,
  factoryValue,
  previewMode,
  onChange,
  disabled,
  labels,
}: TokenFieldProps) {
  const bucketValue = getEffectiveThemeToken(value, previewMode, tokenKey) ?? "";
  const factoryValueForToken = getEffectiveThemeToken(factoryValue, previewMode, tokenKey);
  const isReset = factoryValueForToken !== undefined && factoryValueForToken !== bucketValue;

  const handleChange = (next: string) => {
    if (!isValidColorString(next)) return;
    onChange(setThemeToken(value, previewMode, tokenKey, next));
  };

  const handleReset = () => {
    onChange(resetThemeToken(value, factoryValue, previewMode, tokenKey));
  };

  const tokenLabel = labels.tokens?.[tokenKey] ?? humanizeTokenKey(tokenKey);
  const fallbackAria = labels.colorSwatchFallback;

  return (
    <CustomizerField
      label={tokenLabel}
      layout="inline-start"
      onReset={isReset ? handleReset : undefined}
      resetLabel={labels.resetField}
      resetAriaLabel={`${labels.resetField} ${typeof tokenLabel === "string" || typeof tokenLabel === "number" ? String(tokenLabel) : ""}`.trim()}
      disabled={disabled}
    >
      <div
        role="group"
        aria-label={
          typeof tokenLabel === "string" || typeof tokenLabel === "number"
            ? String(tokenLabel)
            : typeof fallbackAria === "string" || typeof fallbackAria === "number"
              ? String(fallbackAria)
              : "Color"
        }
        data-disabled={disabled ? "" : undefined}
        className={cn(disabled && "pointer-events-none opacity-60")}
      >
        <ColorPickerInput
          mode="popover"
          output="preserve"
          value={bucketValue || "oklch(0.5 0 0)"}
          onChange={handleChange}
          disabled={disabled}
          className="h-9 w-full gap-2 px-2 py-1 text-xs [&>span:first-child]:size-6 [&>span:last-child]:text-xs"
        />
      </div>
    </CustomizerField>
  );
}

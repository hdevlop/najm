import * as React from "react";
import { ChevronDown } from "lucide-react";
import { SelectInput } from "../inputs/SelectInput";
import { CustomizerField } from "./CustomizerField";
import {
  FONT_SIZE_VALUES,
  LETTER_SPACING_VALUES,
  LINE_HEIGHT_VALUES,
  SCALE_VALUES,
  setTypographyField,
} from "./theme-customizer-config";
import { DEFAULT_OPTION_LABELS } from "./theme-customizer-meta";
import type {
  NThemeCustomizerFontOption,
  NThemeCustomizerOptionLabels,
} from "./types";
import type { NajmDesignConfig, NajmTypographyConfig } from "../../theme/design-types";

export interface ThemeCustomizerTypographyTabLabels {
  resetField: React.ReactNode;
  defaultOption: React.ReactNode;
  fontSans: React.ReactNode;
  fontHeading: React.ReactNode;
  fontMono: React.ReactNode;
  advancedTypography: React.ReactNode;
  baseSize: React.ReactNode;
  scale: React.ReactNode;
  lineHeight: React.ReactNode;
  letterSpacing: React.ReactNode;
  options: Partial<NThemeCustomizerOptionLabels>;
}

export interface ThemeCustomizerTypographyTabProps {
  value: NajmDesignConfig;
  factoryValue: NajmDesignConfig;
  onChange: (value: NajmDesignConfig) => void;
  fontOptions?: readonly NThemeCustomizerFontOption[];
  labels: ThemeCustomizerTypographyTabLabels;
  disabled?: boolean;
}

export function ThemeCustomizerTypographyTab({
  value,
  onChange,
  fontOptions,
  labels,
  disabled,
}: ThemeCustomizerTypographyTabProps) {
  const typography = value.typography ?? {};

  const labelToString = (node: React.ReactNode): string => {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(labelToString).join("");
    if (node && typeof node === "object" && "props" in node) {
      // @ts-expect-error - React element children
      return labelToString(node.props.children);
    }
    return "";
  };

  const handleTypography = <K extends keyof NajmTypographyConfig>(
    key: K,
    next: NajmTypographyConfig[K] | undefined,
  ) => {
    onChange(setTypographyField(value, key, next));
  };

  const toOption = (node: React.ReactNode, value: string) => ({
    value,
    label: labelToString(node) || value,
  });

  return (
    <div className="grid grid-cols-1 gap-3">
      {fontOptions && fontOptions.length > 0 ? (
        <FontSelect
          label={labels.fontSans}
          value={typography.fontSans}
          onChange={(next) => handleTypography("fontSans", next)}
          fontOptions={fontOptions}
          disabled={disabled}
        />
      ) : null}

      <CustomizerField
        label={labels.baseSize}
        disabled={disabled}
      >
        <SelectInput
          value={typography.baseSize ?? ""}
          onChange={(next) =>
            handleTypography("baseSize", next || undefined)
          }
          items={[
            toOption(labels.defaultOption, ""),
            ...FONT_SIZE_VALUES.map((value) => ({ value, label: value })),
          ]}
          disabled={disabled}
          ariaLabel={typeof labels.baseSize === "string" ? labels.baseSize : "Base size"}
        />
      </CustomizerField>

      <details className="group rounded-md border border-border bg-card/35">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
          {labels.advancedTypography}
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <div className="grid grid-cols-1 gap-3 border-t border-border px-3 py-3">
          {fontOptions && fontOptions.length > 0 ? (
            <>
              <FontSelect
                label={labels.fontHeading}
                value={typography.fontHeading}
                onChange={(next) => handleTypography("fontHeading", next)}
                fontOptions={fontOptions}
                disabled={disabled}
              />
              <FontSelect
                label={labels.fontMono}
                value={typography.fontMono}
                onChange={(next) => handleTypography("fontMono", next)}
                fontOptions={fontOptions}
                disabled={disabled}
              />
            </>
          ) : null}

          <CustomizerField label={labels.scale} disabled={disabled}>
            <SelectInput
              value={typography.scale ?? ""}
              onChange={(next) =>
                handleTypography(
                  "scale",
                  (next || undefined) as typeof typography.scale,
                )
              }
              items={[
                toOption(labels.defaultOption, ""),
                ...SCALE_VALUES.map((o) => ({
                  value: o.value,
                  label: labelToString(
                    labels.options?.scale?.[o.key] ??
                      DEFAULT_OPTION_LABELS.scale[o.key],
                  ),
                })),
              ]}
              disabled={disabled}
              ariaLabel={typeof labels.scale === "string" ? labels.scale : "Scale"}
            />
          </CustomizerField>

          <CustomizerField label={labels.lineHeight} disabled={disabled}>
            <SelectInput
              value={typography.lineHeight ?? ""}
              onChange={(next) =>
                handleTypography("lineHeight", next || undefined)
              }
              items={[
                toOption(labels.defaultOption, ""),
                ...LINE_HEIGHT_VALUES.map((value) => ({ value, label: value })),
              ]}
              disabled={disabled}
              ariaLabel={
                typeof labels.lineHeight === "string"
                  ? labels.lineHeight
                  : "Line height"
              }
            />
          </CustomizerField>

          <CustomizerField label={labels.letterSpacing} disabled={disabled}>
            <SelectInput
              value={typography.letterSpacing ?? ""}
              onChange={(next) =>
                handleTypography("letterSpacing", next || undefined)
              }
              items={[
                toOption(labels.defaultOption, ""),
                ...LETTER_SPACING_VALUES.map((value) => ({ value, label: value })),
              ]}
              disabled={disabled}
              ariaLabel={
                typeof labels.letterSpacing === "string"
                  ? labels.letterSpacing
                  : "Letter spacing"
              }
            />
          </CustomizerField>
        </div>
      </details>
    </div>
  );
}

interface FontSelectProps {
  label: React.ReactNode;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  fontOptions: readonly NThemeCustomizerFontOption[];
  disabled?: boolean;
}

function FontSelect({
  label,
  value,
  onChange,
  fontOptions,
  disabled,
}: FontSelectProps) {
  const known = !!value && fontOptions.some((opt) => opt.value === value);

  const labelToString = (node: React.ReactNode): string => {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(labelToString).join("");
    if (node && typeof node === "object" && "props" in node) {
      // @ts-expect-error - React element children
      return labelToString(node.props.children);
    }
    return "";
  };

  const options: { value: string; label: string }[] = [
    { value: "", label: "Default" },
    ...(value && !known ? [{ value, label: value }] : []),
    ...fontOptions.map((opt) => ({
      value: opt.value,
      label: labelToString(opt.label) || opt.value,
    })),
  ];

  return (
    <CustomizerField
      label={label}
      disabled={disabled}
    >
      <SelectInput
        value={value ?? ""}
        onChange={(next) => onChange(next || undefined)}
        items={options}
        disabled={disabled}
        ariaLabel={typeof label === "string" ? label : "Font"}
      />
    </CustomizerField>
  );
}

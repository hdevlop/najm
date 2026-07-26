import * as React from "react";
import { cn } from "../../lib/cn";
import { NTabs } from "../tabs";
import { NButton } from "../Button";
import { Download, RotateCcw, Upload } from "lucide-react";
import { ThemeCustomizerThemeTab } from "./ThemeCustomizerThemeTab";
import { ThemeCustomizerTypographyTab } from "./ThemeCustomizerTypographyTab";
import { ThemeCustomizerComponentsLayoutTab } from "./ThemeCustomizerComponentsLayoutTab";
import {
  resetComponentsLayoutSection,
  resetThemeSection,
  resetTypographySection,
} from "./theme-customizer-config";
import { DEFAULT_LABELS } from "./theme-customizer-meta";
import { useNajmThemeMode } from "../../theme/provider";
import {
  normalizeThemeFileName,
  parseThemeFile,
  stringifyThemeFile,
} from "./theme-customizer-file";
import type {
  NThemeCustomizerProps,
  NThemeCustomizerTab,
  NThemeCustomizerLabels,
} from "./types";

const DEFAULT_TABS: readonly NThemeCustomizerTab[] = [
  "theme",
  "typography",
];

const TAB_VALUE: Record<NThemeCustomizerTab, string> = {
  theme: "theme",
  typography: "typography",
};

function buildTabs(tabs: readonly NThemeCustomizerTab[] | undefined): readonly NThemeCustomizerTab[] {
  if (!tabs) return DEFAULT_TABS;
  const seen = new Set<string>();
  const filtered: NThemeCustomizerTab[] = [];
  for (const tab of tabs) {
    if (!DEFAULT_TABS.includes(tab)) continue;
    if (seen.has(tab)) continue;
    seen.add(tab);
    filtered.push(tab);
  }
  return filtered.length > 0 ? filtered : DEFAULT_TABS;
}

function resolveLabel<T extends keyof NThemeCustomizerLabels>(
  key: T,
  labels: NThemeCustomizerProps["labels"],
): NThemeCustomizerLabels[T] {
  const override = labels?.[key];
  if (override === undefined) {
    return DEFAULT_LABELS[key] as NThemeCustomizerLabels[T];
  }
  return override as NThemeCustomizerLabels[T];
}

function resolveTokenLabel<K extends keyof NThemeCustomizerLabels["tokens"]>(
  key: K,
  labels: NThemeCustomizerProps["labels"],
): NThemeCustomizerLabels["tokens"][K] {
  const override = labels?.tokens?.[key];
  if (override !== undefined) return override;
  return DEFAULT_LABELS[key] as NThemeCustomizerLabels["tokens"][K];
}

export function NThemeCustomizer({
  value,
  factoryValue,
  onChange,
  previewMode,
  onPreviewModeChange,
  showPreviewMode = false,
  showFileActions = true,
  showResetAction = true,
  exportFileName,
  onImportError,
  showTabs = true,
  tabs,
  fontOptions,
  labels,
  disabled = false,
  className,
}: NThemeCustomizerProps) {
  const inheritedMode = useNajmThemeMode();
  const resolvedPreviewMode =
    previewMode ?? inheritedMode ?? value.theme.mode ?? "light";
  const visibleTabs = React.useMemo(() => buildTabs(tabs), [tabs]);
  const firstTab = visibleTabs[0] ?? "theme";
  const [activeTab, setActiveTab] = React.useState<string>(TAB_VALUE[firstTab]);
  const [fileError, setFileError] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setActiveTab(TAB_VALUE[firstTab]);
  }, [firstTab]);

  const themeLabel = resolveLabel("themeTab", labels);
  const typographyLabel = resolveLabel("typographyTab", labels);
  const resetSectionLabel = resolveLabel("resetSection", labels);
  const resetFieldLabel = resolveLabel("resetField", labels);
  const importThemeLabel = resolveLabel("importTheme", labels);
  const exportThemeLabel = resolveLabel("exportTheme", labels);
  const invalidThemeFileLabel = resolveLabel("invalidThemeFile", labels);
  const defaultOptionLabel = resolveLabel("defaultOption", labels);
  const colorSwatchFallbackLabel = resolveLabel("colorSwatchFallback", labels);

  const tokenLabels = React.useMemo(() => {
    const out: Record<string, React.ReactNode> = {};
    const knownTokens: readonly (keyof NThemeCustomizerLabels["tokens"])[] = [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "popover",
      "popover-foreground",
      "primary",
      "primary-foreground",
      "secondary",
      "secondary-foreground",
      "tertiary",
      "tertiary-foreground",
      "muted",
      "muted-foreground",
      "accent",
      "accent-foreground",
      "destructive",
      "destructive-foreground",
      "border",
      "input",
      "ring",
      "sidebar",
      "sidebar-foreground",
      "sidebar-primary",
      "sidebar-primary-foreground",
      "sidebar-accent",
      "sidebar-accent-foreground",
      "sidebar-border",
      "sidebar-ring",
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
    ];
    for (const tokenKey of knownTokens) {
      out[tokenKey] = resolveTokenLabel(tokenKey, labels);
    }
    return out;
  }, [labels]);

  const themeContent = (
    <div className="space-y-4">
      <ThemeCustomizerThemeTab
        value={value}
        factoryValue={factoryValue}
        onChange={onChange}
        previewMode={resolvedPreviewMode}
        onPreviewModeChange={onPreviewModeChange}
        showPreviewMode={showPreviewMode && Boolean(onPreviewModeChange)}
        disabled={disabled}
        labels={{
          resetField: resetFieldLabel,
          resetSection: resetSectionLabel,
          colorSwatchFallback: colorSwatchFallbackLabel,
          defaultOption: defaultOptionLabel,
          lightMode: resolveLabel("lightMode", labels),
          darkMode: resolveLabel("darkMode", labels),
          surfaceGroup: resolveLabel("surfaceGroup", labels),
          brandGroup: resolveLabel("brandGroup", labels),
          feedbackGroup: resolveLabel("feedbackGroup", labels),
          borderFocusGroup: resolveLabel("borderFocusGroup", labels),
          sidebarGroup: resolveLabel("sidebarGroup", labels),
          chartsGroup: resolveLabel("chartsGroup", labels),
          globalBorderWidth: resolveLabel("globalBorderWidth", labels),
          tableSubsection: resolveLabel("tableSubsection", labels),
          tableHeaderColor: resolveLabel("tableHeaderColor", labels),
          tableHeaderTextColor: resolveLabel("tableHeaderTextColor", labels),
          tableBorderColor: resolveLabel("tableBorderColor", labels),
          previewMode: resolveLabel("previewMode", labels),
          tokens: tokenLabels,
          options: labels?.options ?? {},
        }}
      />
      <div className="border-t border-border pt-4">
        <ThemeCustomizerComponentsLayoutTab
          value={value}
          factoryValue={factoryValue}
          onChange={onChange}
          disabled={disabled}
          showTableColors={false}
          labels={{
            resetField: resetFieldLabel,
            defaultOption: defaultOptionLabel,
            layoutSubsection: resolveLabel("layoutSubsection", labels),
            pageHeaderSubsection: resolveLabel("pageHeaderSubsection", labels),
            sidebarSubsection: resolveLabel("sidebarSubsection", labels),
            tableSubsection: resolveLabel("tableSubsection", labels),
            inputSubsection: resolveLabel("inputSubsection", labels),
            pageGutter: resolveLabel("pageGutter", labels),
            sectionGap: resolveLabel("sectionGap", labels),
            pageHeaderCard: resolveLabel("pageHeaderCard", labels),
            sidebarSectionLabels: resolveLabel("sidebarSectionLabels", labels),
            sidebarSectionSeparators: resolveLabel("sidebarSectionSeparators", labels),
            tableHeaderColor: resolveLabel("tableHeaderColor", labels),
            tableHeaderTextColor: resolveLabel("tableHeaderTextColor", labels),
            tableBorderColor: resolveLabel("tableBorderColor", labels),
            inputBorderWidth: resolveLabel("inputBorderWidth", labels),
            globalBorderWidth: resolveLabel("globalBorderWidth", labels),
            globalRadius: resolveLabel("globalRadius", labels),
          }}
        />
      </div>
    </div>
  );

  const typographyContent = (
    <ThemeCustomizerTypographyTab
      value={value}
      factoryValue={factoryValue}
      onChange={onChange}
      fontOptions={fontOptions}
      disabled={disabled}
      labels={{
        resetField: resetFieldLabel,
        defaultOption: defaultOptionLabel,
        fontSans: resolveLabel("fontSans", labels),
        fontHeading: resolveLabel("fontHeading", labels),
        fontMono: resolveLabel("fontMono", labels),
        advancedTypography: resolveLabel("advancedTypography", labels),
        baseSize: resolveLabel("baseSize", labels),
        scale: resolveLabel("scale", labels),
        options: labels?.options ?? {},
        lineHeight: resolveLabel("lineHeight", labels),
        letterSpacing: resolveLabel("letterSpacing", labels),
      }}
    />
  );

  const items = visibleTabs.map((tab) => {
    if (tab === "theme") {
      return {
        value: TAB_VALUE.theme,
        label: themeLabel,
        disabled,
        content: themeContent,
      };
    }
    return {
      value: TAB_VALUE.typography,
      label: typographyLabel,
      disabled,
      content: typographyContent,
    };
  });

  const handleResetTheme = () =>
    onChange(resetComponentsLayoutSection(resetThemeSection(value, factoryValue), factoryValue));
  const handleResetTypography = () =>
    onChange(resetTypographySection(value, factoryValue));
  const handleReset = () => {
    const target = showTabs ? activeTab : TAB_VALUE[firstTab];
    if (target === TAB_VALUE.theme) handleResetTheme();
    else handleResetTypography();
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    try {
      const imported = parseThemeFile(await file.text());
      setFileError(false);
      onChange(imported);
    } catch (cause) {
      const error =
        cause instanceof Error ? cause : new Error(String(cause));
      setFileError(true);
      onImportError?.(error);
    }
  };

  const handleExportFile = () => {
    const blob = new Blob([stringifyThemeFile(value)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = normalizeThemeFileName(exportFileName);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const directContent = items[0]?.content ?? themeContent;

  return (
    <div
      data-najm-theme-customizer=""
      data-disabled={disabled ? "" : undefined}
      className={cn(
        "@container flex min-w-0 max-w-full flex-col gap-2.5 text-foreground",
        className,
      )}
    >
      {showTabs ? (
        <NTabs
          items={items}
          value={activeTab}
          onValueChange={setActiveTab}
          variant="pills"
          fullWidth
          className="w-full"
          classNames={{
            list: "h-8 min-w-0",
            trigger: "min-w-0 px-1.5 text-xs",
          }}
        />
      ) : (
        directContent
      )}

      {fileError ? (
        <p role="alert" className="text-xs text-destructive">
          {invalidThemeFileLabel}
        </p>
      ) : null}

      {showFileActions || showResetAction ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {showFileActions ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                disabled={disabled}
                onChange={(event) => void handleImportFile(event)}
              />
              <NButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                <Upload className="size-3.5" />
                <span>{importThemeLabel}</span>
              </NButton>
              <NButton
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportFile}
                disabled={disabled}
              >
                <Download className="size-3.5" />
                <span>{exportThemeLabel}</span>
              </NButton>
            </div>
          ) : null}
          {showResetAction ? (
            <NButton
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={disabled}
              aria-label={
                typeof resetSectionLabel === "string" || typeof resetSectionLabel === "number"
                  ? String(resetSectionLabel)
                  : "Reset section"
              }
            >
              <RotateCcw className="size-3.5" />
              <span>{resetSectionLabel}</span>
            </NButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

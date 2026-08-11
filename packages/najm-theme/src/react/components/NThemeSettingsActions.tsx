// ============================================================================
// najm-theme/react — the action bar
// ============================================================================

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  NButton,
  NConfirmDialog,
  NIcon,
  parseNajmDesignConfig,
  stringifyNajmDesignConfig,
} from "najm-kit";

import { useNThemeSettingsOptional } from "../providers/NThemeSettingsProvider";
import { NThemeSettingsResetButton } from "./NThemeSettingsResetButton";
import { NThemeSettingsSaveButton } from "./NThemeSettingsSaveButton";
import { NThemeSettingsStatus } from "./NThemeSettingsStatus";

type ThemeResource = "appearance" | "branding";

export interface NThemeSettingsActionsProps {
  className?: string;
  /** Limit the bar to these resources. Defaults to every enabled one. */
  resources?: readonly ThemeResource[];
  showStatus?: boolean;
  showReset?: boolean;
  showDiscard?: boolean;
  /** Put Import/Export beside the persistence actions. */
  showFileActions?: boolean;
  /** Icon-only controls with one reset menu. The default keeps text buttons. */
  display?: "default" | "compact";
  /** Download filename. `.json` is appended when omitted. */
  exportFileName?: string;
  onImportError?: (error: Error) => void;
}

function normalizeThemeFileName(value: string | undefined): string {
  const name = value?.trim() || "najm-theme.json";
  return name.toLowerCase().endsWith(".json") ? name : `${name}.json`;
}

/**
 * The single persistence surface for whichever sections are mounted above it.
 *
 * The compact form deliberately folds the two destructive resets into one
 * named menu. That keeps the familiar Import / Export / Reset / Save rhythm
 * without making appearance and branding share an ambiguous reset command.
 */
export function NThemeSettingsActions({
  className,
  resources,
  showStatus = true,
  showReset = true,
  showDiscard = true,
  showFileActions = false,
  display = "default",
  exportFileName,
  onImportError,
}: NThemeSettingsActionsProps) {
  const settings = useNThemeSettingsOptional();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = React.useState(false);
  const [resetResource, setResetResource] = React.useState<ThemeResource | null>(null);

  if (!settings) return null;

  const {
    appearance,
    capabilities,
    design,
    dirty,
    discardDrafts,
    features,
    resetAppearance,
    resetBranding,
    setDesignDraft,
    status,
    t,
  } = settings;

  const shows = (resource: ThemeResource) =>
    (resources === undefined || resources.includes(resource)) && features[resource];

  const canEditAppearance = shows("appearance") && capabilities.manageAppearance;
  const canResetBranding = shows("branding") && capabilities.manageBranding;
  const canResetAppearance = canEditAppearance;
  const compact = display === "compact";

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    try {
      const imported = parseNajmDesignConfig(JSON.parse(await file.text()) as unknown);
      setFileError(false);
      setDesignDraft(imported);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      setFileError(true);
      onImportError?.(error);
    }
  };

  const handleExport = () => {
    if (!design) return;
    const blob = new Blob([stringifyNajmDesignConfig(design)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = normalizeThemeFileName(exportFileName);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const appearanceAlreadyFactory = appearance?.isFactory === true;
  const hasResetChoice =
    (canResetAppearance && !appearanceAlreadyFactory) || canResetBranding;
  const resetLabel = resetResource === "branding"
    ? t("theme.actions.resetBranding")
    : t("theme.actions.resetAppearance");

  return (
    <div className={`najm-theme-actions ${className ?? ""}`.trim()} data-najm-theme-actions="">
      {showStatus ? <NThemeSettingsStatus /> : null}
      {fileError ? (
        <p className="najm-theme-file-error" role="alert">
          {t("theme.errors.invalidThemeFile")}
        </p>
      ) : null}

      <div className="najm-theme-actions-buttons">
        {showFileActions && shows("appearance") ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              disabled={!canEditAppearance || status.phase === "saving"}
              onChange={(event) => void handleImport(event)}
            />
            <NButton
              type="button"
              variant="outline"
              size={compact ? "icon-sm" : "sm"}
              aria-label={compact ? t("theme.actions.import") : undefined}
              title={compact ? t("theme.actions.import") : undefined}
              disabled={!canEditAppearance || status.phase === "saving"}
              onClick={() => fileInputRef.current?.click()}
            >
              <NIcon icon="upload" aria-hidden="true" />
              {compact ? null : t("theme.actions.import")}
            </NButton>
            <NButton
              type="button"
              variant="outline"
              size={compact ? "icon-sm" : "sm"}
              aria-label={compact ? t("theme.actions.export") : undefined}
              title={compact ? t("theme.actions.export") : undefined}
              disabled={!design}
              onClick={handleExport}
            >
              <NIcon icon="download" aria-hidden="true" />
              {compact ? null : t("theme.actions.export")}
            </NButton>
          </>
        ) : null}

        {showDiscard ? (
          <NButton
            variant={compact ? "outline" : "ghost"}
            size={compact ? "icon-sm" : undefined}
            aria-label={compact ? t("theme.actions.discard") : undefined}
            title={compact ? t("theme.actions.discard") : undefined}
            onClick={() => discardDrafts()}
            disabled={!dirty.any || status.phase === "saving"}
          >
            {compact ? <NIcon icon="undo-2" aria-hidden="true" /> : t("theme.actions.discard")}
          </NButton>
        ) : null}

        {showReset && compact ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <NButton
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={t("theme.actions.reset")}
                title={t("theme.actions.reset")}
                disabled={!hasResetChoice || status.phase === "resetting"}
              >
                <NIcon icon="rotate-ccw" aria-hidden="true" />
              </NButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end">
              {canResetAppearance ? (
                <DropdownMenuItem
                  disabled={appearanceAlreadyFactory}
                  onSelect={() => setResetResource("appearance")}
                >
                  <NIcon icon="palette" aria-hidden="true" />
                  {t("theme.actions.resetAppearance")}
                </DropdownMenuItem>
              ) : null}
              {canResetBranding ? (
                <DropdownMenuItem onSelect={() => setResetResource("branding")}>
                  <NIcon icon="image-off" aria-hidden="true" />
                  {t("theme.actions.resetBranding")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {showReset && !compact && shows("appearance") ? (
          <NThemeSettingsResetButton resource="appearance" />
        ) : null}
        {showReset && !compact && shows("branding") ? (
          <NThemeSettingsResetButton resource="branding" />
        ) : null}

        <NThemeSettingsSaveButton
          className="najm-theme-actions-save"
          resources={resources}
          size={compact ? "icon-sm" : undefined}
          aria-label={compact ? t("theme.actions.save") : undefined}
          title={compact ? t("theme.actions.save") : undefined}
        >
          {compact ? <NIcon icon="save" aria-hidden="true" /> : undefined}
        </NThemeSettingsSaveButton>
      </div>

      {compact && resetResource ? (
        <NConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setResetResource(null);
          }}
          variant="destructive"
          title={t(
            resetResource === "appearance"
              ? "theme.confirm.resetAppearanceTitle"
              : "theme.confirm.resetBrandingTitle",
          )}
          description={t(
            resetResource === "appearance"
              ? "theme.confirm.resetAppearanceBody"
              : "theme.confirm.resetBrandingBody",
          )}
          confirmLabel={resetLabel}
          cancelLabel={t("theme.actions.cancel")}
          loading={status.phase === "resetting"}
          onConfirm={() => {
            const resource = resetResource;
            setResetResource(null);
            void (resource === "appearance" ? resetAppearance() : resetBranding());
          }}
        />
      ) : null}
    </div>
  );
}

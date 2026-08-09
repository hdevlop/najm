// ============================================================================
// najm-theme/react — the Presets section
// ============================================================================

import * as React from "react";
import { NButton, NThemePresets, NSpinner } from "najm-kit";
import type { NThemePreset, NThemePresetsLabels } from "najm-kit";

import { useNThemeSettingsOptional } from "../providers/NThemeSettingsProvider";
import type { ThemeTranslator } from "../translations";

export interface NThemePresetSettingsProps {
  className?: string;
  disabled?: boolean;
  /**
   * Hide the Apply button and let a shared action bar commit the selection
   * instead. The preview still happens on selection either way.
   */
  showApplyAction?: boolean;
}

function presetLabels(t: ThemeTranslator): NThemePresetsLabels {
  return {
    title: t("theme.sections.presetsTitle"),
    description: t("theme.sections.presetsDescription"),
    empty: t("theme.presetLabels.empty"),
    loadError: t("theme.errors.loadFailed"),
    select: t("theme.presetLabels.select"),
    selectPlaceholder: t("theme.presetLabels.selectPlaceholder"),
    savedOption: t("theme.presetLabels.savedOption"),
    saveCurrent: t("theme.presetLabels.saveCurrent"),
    saveTitle: t("theme.presetLabels.saveTitle"),
    saveDescription: t("theme.presetLabels.saveDescription"),
    saveAction: t("theme.actions.save"),
    nameLabel: t("theme.presetLabels.nameLabel"),
    namePlaceholder: t("theme.presetLabels.namePlaceholder"),
    delete: t("theme.actions.clear"),
    deleteTitle: t("theme.confirm.deletePresetTitle"),
    deleteDescription: t("theme.confirm.deletePresetBody"),
    cancel: t("theme.actions.cancel"),
  };
}

/**
 * The saved-theme library.
 *
 * Selecting a preset previews it **in memory** — the design goes into the same
 * draft a hand edit uses, so a preview can be adjusted before it is committed,
 * and closing the sheet without applying leaves the platform exactly as it was.
 * Persisting happens only through Apply (or a shared action bar), which sends
 * the appearance revision and goes through the same lock a Save does.
 */
export function NThemePresetSettings({
  className,
  disabled,
  showApplyAction = true,
}: NThemePresetSettingsProps) {
  const settings = useNThemeSettingsOptional();

  if (!settings || !settings.features.presets) return null;

  const {
    presets,
    presetLimits,
    selectedPresetId,
    previewPreset,
    applySelectedPreset,
    createPreset,
    deletePreset,
    appearance,
    capabilities,
    loading,
    status,
    t,
  } = settings;

  if (loading) {
    return (
      <div
        className={className}
        role="status"
        aria-busy="true"
        aria-label={t("theme.status.loading")}
      >
        <NSpinner />
      </div>
    );
  }

  const readOnly = disabled || !capabilities.managePresets;
  const atLimit = presetLimits !== undefined && presets.length >= presetLimits.maxPresets;

  const kitPresets: NThemePreset[] = presets.map((preset) => ({
    id: preset.id,
    name: preset.name,
    design: preset.designConfig,
    isBuiltIn: preset.isBuiltIn,
  }));

  // The server's policy, read rather than re-decided. A delete control the
  // backend would refuse is worse than no control; so is hiding one it allows.
  const canDeleteBuiltIn = presetLimits?.allowBuiltInPresetDeletion ?? false;
  const deletable = (preset: NThemePreset) => !preset.isBuiltIn || canDeleteBuiltIn;

  return (
    <div className={className} data-najm-theme-section="presets">
      <NThemePresets
        presets={kitPresets}
        selectedPresetId={selectedPresetId}
        savedDesign={appearance?.designConfig}
        status={status.phase === "error" ? "error" : "idle"}
        onSelect={(preset) =>
          previewPreset(preset ? (presets.find((row) => row.id === preset.id) ?? null) : null)
        }
        onSave={
          readOnly || atLimit ? undefined : (name) => createPreset(name)
        }
        onDelete={
          readOnly
            ? undefined
            : (preset) => {
                if (!deletable(preset)) return;
                const row = presets.find((candidate) => candidate.id === preset.id);
                if (row) return deletePreset(row);
              }
        }
        labels={presetLabels(t)}
        disabled={readOnly}
      />

      {atLimit ? (
        <p className="najm-theme-note" role="status">
          {t("theme.presetLabels.limitReached")}
        </p>
      ) : null}

      {selectedPresetId && showApplyAction ? (
        <div className="najm-theme-preset-apply">
          {/* Said out loud rather than implied by the selector's state: the
              page has already restyled, and without this the change looks
              saved. */}
          <p role="status">{t("theme.presetLabels.previewNotice")}</p>
          <NButton
            onClick={() => applySelectedPreset()}
            loading={status.phase === "saving"}
            disabled={readOnly}
          >
            {t("theme.presetLabels.apply")}
          </NButton>
        </div>
      ) : null}
    </div>
  );
}
